import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/billing/webhook
 *
 * Receives Stripe events and flips users between plans. Critical:
 * - We must read the raw body for signature verification, so the
 *   default Next.js body parser is disabled.
 * - We're idempotent on events Stripe may resend; nothing here writes
 *   on first-write semantics.
 *
 * The Stripe v22 CJS bundle does not re-export inner namespace types
 * (Subscription, Event, etc.) under `import Stripe from "stripe"`,
 * so we use a small shape-only interface for what we actually read.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

type StripeMetadata = { [key: string]: string } | null | undefined;

type StripeSubscriptionLike = {
  id: string;
  status: string;
  metadata?: StripeMetadata;
  current_period_end?: number;
  items?: {
    data?: Array<{ current_period_end?: number }>;
  };
};

type StripeCheckoutSessionLike = {
  mode?: string;
  subscription?: string | { id: string } | null;
  metadata?: StripeMetadata;
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function periodEndOf(sub: StripeSubscriptionLike): Date | null {
  if (typeof sub.current_period_end === "number") {
    return new Date(sub.current_period_end * 1000);
  }
  const item = sub.items?.data?.[0];
  if (item?.current_period_end) return new Date(item.current_period_end * 1000);
  return null;
}

async function applySubscription(sub: StripeSubscriptionLike) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.warn("webhook: subscription has no userId in metadata", sub.id);
    return;
  }
  const status = sub.status;
  const isPro =
    status === "active" || status === "trialing" || status === "past_due";

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: isPro ? "pro" : "free",
      stripeSubscriptionId: sub.id,
      subscriptionStatus: status,
      subscriptionCurrentPeriodEnd: periodEndOf(sub),
    },
  });
}

async function clearSubscription(sub: StripeSubscriptionLike) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: "free",
      stripeSubscriptionId: null,
      subscriptionStatus: sub.status,
      subscriptionCurrentPeriodEnd: periodEndOf(sub),
    },
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("webhook: STRIPE_WEBHOOK_SECRET not configured, rejecting");
    return res.status(503).json({ error: "Webhook not configured yet" });
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  const raw = await readRawBody(req);
  let event: { type: string; data: { object: unknown } };
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret) as typeof event;
  } catch (err) {
    console.error("webhook: signature verification failed", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as StripeCheckoutSessionLike;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (session.mode === "subscription" && subId) {
          const sub = (await stripe.subscriptions.retrieve(subId)) as unknown as StripeSubscriptionLike;
          // Stamp userId on the subscription if Checkout only put it on the session.
          if (!sub.metadata?.userId && session.metadata?.userId) {
            await stripe.subscriptions.update(sub.id, {
              metadata: { userId: session.metadata.userId },
            });
            sub.metadata = { ...(sub.metadata ?? {}), userId: session.metadata.userId };
          }
          await applySubscription(sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applySubscription(event.data.object as StripeSubscriptionLike);
        break;
      }

      case "customer.subscription.deleted": {
        await clearSubscription(event.data.object as StripeSubscriptionLike);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("webhook: handler failed for", event.type, err);
    return res.status(500).json({ error: "Handler failed" });
  }

  return res.status(200).json({ received: true });
}

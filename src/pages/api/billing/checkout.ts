import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICE_ID_PRO } from "@/lib/stripe";

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for the Pro plan and returns the
 * redirect URL. The recruiter must be signed in. If they don't yet have
 * a Stripe Customer, we create one and stash the ID on their row so we
 * can look it up from webhook payloads.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user?.email) {
    return res.status(401).json({ error: "Not signed in" });
  }
  if (!STRIPE_PRICE_ID_PRO) {
    return res.status(500).json({ error: "STRIPE_PRICE_ID_PRO not configured" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
      plan: true,
    },
  });
  if (!user?.email) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.plan === "pro") {
    return res.status(400).json({ error: "Already on Pro" });
  }

  // Lazily create a Stripe Customer for this user the first time they
  // checkout. We avoid creating one at signup so we don't pollute Stripe
  // with customers who never reach the billing flow.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers.host ?? "localhost:3000";
  const origin = `${protocol}://${host}`;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID_PRO, quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing?canceled=1`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: user.id },
    },
    metadata: { userId: user.id },
  });

  if (!checkout.url) {
    return res.status(502).json({ error: "Stripe did not return a checkout URL" });
  }

  return res.status(200).json({ url: checkout.url });
}

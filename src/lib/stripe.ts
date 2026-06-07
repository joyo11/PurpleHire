import Stripe from "stripe";

/** Single Stripe client used by all billing routes. The API version is
 * pinned so future SDK upgrades don't silently change behavior. */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

export const STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO ?? "";

export type PlanName = "free" | "pro";

/** Hard cap on free-plan completed interviews per calendar month. */
export const FREE_PLAN_MONTHLY_INTERVIEWS = 10;

/** True when the subscription record on the user row implies they have
 * an active Pro plan right now. Used as the gate everywhere. */
export function isProActive(args: {
  plan: string;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: Date | null;
}): boolean {
  if (args.plan !== "pro") return false;
  if (!args.subscriptionStatus) return false;
  // active and trialing both grant access. past_due gets a short grace
  // period of 3 days after the period end before we downgrade them.
  if (args.subscriptionStatus === "active" || args.subscriptionStatus === "trialing") {
    return true;
  }
  if (args.subscriptionStatus === "past_due" && args.subscriptionCurrentPeriodEnd) {
    const graceEnd = new Date(args.subscriptionCurrentPeriodEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
    return new Date() < graceEnd;
  }
  return false;
}

/**
 * Pure plan helpers, safe to import from either server or client code.
 * Does NOT import the Stripe SDK. The actual `stripe` client lives in
 * src/lib/stripe.ts and is server-only.
 */

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
  if (args.subscriptionStatus === "active" || args.subscriptionStatus === "trialing") {
    return true;
  }
  if (args.subscriptionStatus === "past_due" && args.subscriptionCurrentPeriodEnd) {
    const graceEnd = new Date(args.subscriptionCurrentPeriodEnd.getTime() + 3 * 24 * 60 * 60 * 1000);
    return new Date() < graceEnd;
  }
  return false;
}

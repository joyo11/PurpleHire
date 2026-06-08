/**
 * Pure plan helpers, safe to import from either server or client code.
 * Does NOT import the Stripe SDK. The actual `stripe` client lives in
 * src/lib/stripe.ts and is server-only.
 */

export type PlanName = "free" | "pro";

/** Hard cap on free-plan completed interviews per calendar month. */
export const FREE_PLAN_MONTHLY_INTERVIEWS = 10;

/** True if the email matches ADMIN_EMAIL. Admin accounts always get
 * Pro features without going through Stripe — both for operating the
 * product and for grandfathered ownership. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admin = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!admin) return false;
  return email.toLowerCase() === admin;
}

/** True when the user should have Pro features right now. Returns true
 * for admin accounts unconditionally, otherwise checks the Stripe-
 * synced subscription status on the user row. */
export function isProActive(args: {
  plan: string;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: Date | null;
  email?: string | null;
}): boolean {
  if (isAdminEmail(args.email)) return true;
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

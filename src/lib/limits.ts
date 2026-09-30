import { prisma } from "./prisma";
import { FREE_PLAN_MONTHLY_INTERVIEWS, isProActive } from "./plan";

export type UsageGate = {
  plan: "free" | "pro";
  isPro: boolean;
  monthlyInterviews: number;
  monthlyLimit: number | null; // null means unlimited
  allowed: boolean;
  reason?: string;
};

/**
 * Counts how many interviews completed for THIS recruiter's candidates
 * this calendar month. Used to enforce the free-plan cap on
 * /api/interviews/start.
 *
 * Note: we count completed interviews, not started ones, so a recruiter
 * who's mid-month can't be locked out by candidates who abandoned
 * earlier. The trade-off is that someone could in theory start 1000
 * interviews this month and get away with it as long as none complete.
 * Acceptable for V1; if abused, switch to counting started.
 */
async function monthlyCompletedFor(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  // Count completed conversations whose candidate belongs to a role
  // owned by this user, with updatedAt this month.
  return prisma.conversation.count({
    where: {
      status: "completed",
      updatedAt: { gte: startOfMonth },
      candidate: { is: { role: { is: { recruiterId: userId } } } },
    },
  });
}

// Abuse cap: max interviews a free-plan team may START (not complete) per
// month. Generous vs the 10 completed cap, but blocks runaway OpenAI cost.
const FREE_PLAN_MONTHLY_STARTED = 40;

/** Count interviews STARTED this calendar month for this recruiter's
 * candidates (regardless of completion). Backs the abuse cap. */
async function monthlyStartedFor(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  return prisma.conversation.count({
    where: {
      createdAt: { gte: startOfMonth },
      candidate: { is: { role: { is: { recruiterId: userId } } } },
    },
  });
}

/** Check whether the role's owning recruiter is allowed to admit one
 * more interview today. Called from /api/interviews/start before we
 * create the Candidate + Conversation rows. */
export async function checkInterviewQuota(args: {
  recruiterId: string;
}): Promise<UsageGate> {
  const user = await prisma.user.findUnique({
    where: { id: args.recruiterId },
    select: {
      email: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });
  if (!user) {
    return {
      plan: "free",
      isPro: false,
      monthlyInterviews: 0,
      monthlyLimit: FREE_PLAN_MONTHLY_INTERVIEWS,
      allowed: false,
      reason: "Recruiter not found",
    };
  }

  const isPro = isProActive({
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    email: user.email,
  });

  if (isPro) {
    return {
      plan: "pro",
      isPro: true,
      monthlyInterviews: 0,
      monthlyLimit: null,
      allowed: true,
    };
  }

  const used = await monthlyCompletedFor(args.recruiterId);
  const started = await monthlyStartedFor(args.recruiterId);
  // Two free-plan caps: the value cap (completed interviews) and an abuse cap
  // on STARTED interviews, so a bad actor can't run up unbounded OpenAI cost
  // with interviews that never complete (which the completed-count misses).
  const overCompleted = used >= FREE_PLAN_MONTHLY_INTERVIEWS;
  const overStarted = started >= FREE_PLAN_MONTHLY_STARTED;
  const allowed = !overCompleted && !overStarted;
  return {
    plan: "free",
    isPro: false,
    monthlyInterviews: used,
    monthlyLimit: FREE_PLAN_MONTHLY_INTERVIEWS,
    allowed,
    reason: allowed
      ? undefined
      : overStarted
        ? "This team has hit the monthly limit on started interviews. The recruiter needs to upgrade to Pro."
        : "This team has used all 10 free interviews this month. The recruiter needs to upgrade to Pro for unlimited interviews.",
  };
}

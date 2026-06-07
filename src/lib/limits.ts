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

/** Check whether the role's owning recruiter is allowed to admit one
 * more interview today. Called from /api/interviews/start before we
 * create the Candidate + Conversation rows. */
export async function checkInterviewQuota(args: {
  recruiterId: string;
}): Promise<UsageGate> {
  const user = await prisma.user.findUnique({
    where: { id: args.recruiterId },
    select: {
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
  const allowed = used < FREE_PLAN_MONTHLY_INTERVIEWS;
  return {
    plan: "free",
    isPro: false,
    monthlyInterviews: used,
    monthlyLimit: FREE_PLAN_MONTHLY_INTERVIEWS,
    allowed,
    reason: allowed
      ? undefined
      : "This team has used all 10 free interviews this month. The recruiter needs to upgrade to Pro for unlimited interviews.",
  };
}

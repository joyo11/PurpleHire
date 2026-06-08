import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProActive, FREE_PLAN_MONTHLY_INTERVIEWS } from "@/lib/plan";
import {
  PHLogo,
  PHButton,
  PHEyebrow,
  ArrowRight,
  ChevronLeft,
  Check,
} from "@/components/ph";

type Props = {
  signedIn: boolean;
  plan: "free" | "pro";
  showCanceledNotice: boolean;
};

export default function PricingPage({ signedIn, plan, showCanceledNotice }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start checkout.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Pricing · PurpleHire</title>
        <meta
          name="description"
          content="One simple Pro plan. Free for 10 interviews a month, $20/mo for unlimited."
        />
      </Head>
      <main className="ph-radial-purple relative min-h-screen text-white">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6">
          <Link href="/" className="flex items-center gap-2">
            <PHLogo size="md" />
          </Link>
          <Link
            href={signedIn ? "/dashboard" : "/"}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {signedIn ? "Dashboard" : "Home"}
          </Link>
        </header>

        <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <PHEyebrow>Pricing</PHEyebrow>
            </div>
            <h1 className="mb-3 text-[32px] font-medium leading-[1.05] tracking-tight sm:text-[44px]">
              One plan. Pay when you outgrow free.
            </h1>
            <p className="mx-auto max-w-[560px] text-[15px] text-white/65 sm:text-[16px]">
              Free for your first {FREE_PLAN_MONTHLY_INTERVIEWS} completed
              interviews each month. Upgrade to Pro for unlimited everything.
              Cancel anytime.
            </p>
          </div>

          {showCanceledNotice && (
            <div className="mx-auto mt-6 max-w-[600px] rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center text-[13px] text-yellow-200">
              Checkout was canceled. No charges made.
            </div>
          )}

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* FREE */}
            <div
              className={`rounded-3xl border bg-white/[0.02] p-7 transition-colors ${
                plan === "free"
                  ? "border-white/20"
                  : "border-white/10 hover:border-white/15"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-[18px] font-medium tracking-tight">
                  Free
                </div>
                {plan === "free" && (
                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                    Current plan
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-[40px] font-medium tabular-nums">
                  $0
                </span>
                <span className="text-[14px] text-white/45">/month</span>
              </div>
              <p className="mt-2 text-[13px] text-white/55">
                For trying it out on one role.
              </p>

              <ul className="mt-6 space-y-2.5 text-[14px]">
                <Feature>
                  <strong>{FREE_PLAN_MONTHLY_INTERVIEWS} completed
                  interviews</strong> per calendar month
                </Feature>
                <Feature>Unlimited roles</Feature>
                <Feature>Full transcripts + AI scoring</Feature>
                <Feature>Email candidates directly from your own Gmail</Feature>
                <Feature>One-click delete of roles and candidates</Feature>
              </ul>

              <div className="mt-7">
                {signedIn ? (
                  <span className="block rounded-lg border border-white/10 bg-white/[0.02] py-2.5 text-center text-[13px] text-white/55">
                    {plan === "free" ? "You're on Free" : "Available on downgrade"}
                  </span>
                ) : (
                  <Link href="/signin">
                    <PHButton variant="ghost" className="w-full">
                      Start free
                    </PHButton>
                  </Link>
                )}
              </div>
            </div>

            {/* PRO */}
            <div
              className={`relative overflow-hidden rounded-3xl border bg-gradient-to-b from-purple-500/[0.08] to-white/[0.01] p-7 transition-all ${
                plan === "pro"
                  ? "border-purple-500/40 shadow-glow-purple-sm"
                  : "border-white/15 hover:border-purple-500/40"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-[18px] font-medium tracking-tight text-white">
                  Pro
                </div>
                {plan === "pro" ? (
                  <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-purple-300 ring-1 ring-inset ring-purple-500/30">
                    Current plan
                  </span>
                ) : (
                  <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-purple-300 ring-1 ring-inset ring-purple-500/30">
                    Recommended
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="ph-grad-text font-mono text-[40px] font-medium tabular-nums">
                  $20
                </span>
                <span className="text-[14px] text-white/55">/month</span>
              </div>
              <p className="mt-2 text-[13px] text-white/70">
                For real recruiting volume.
              </p>

              <ul className="mt-6 space-y-2.5 text-[14px]">
                <Feature>
                  <strong>Unlimited interviews</strong> across all your roles
                </Feature>
                <Feature>Unlimited roles</Feature>
                <Feature>Full transcripts + AI scoring</Feature>
                <Feature>Email candidates directly from your own Gmail</Feature>
                <Feature>Priority on the upcoming voice-mode launch</Feature>
                <Feature>Cancel any time from the customer portal</Feature>
              </ul>

              <div className="mt-7">
                {!signedIn ? (
                  <Link href="/signin">
                    <PHButton className="w-full" iconRight={<ArrowRight />}>
                      Sign in to upgrade
                    </PHButton>
                  </Link>
                ) : plan === "pro" ? (
                  <Link href="/dashboard">
                    <PHButton variant="ghost" className="w-full">
                      Back to dashboard
                    </PHButton>
                  </Link>
                ) : (
                  <button
                    onClick={upgrade}
                    disabled={loading}
                    className="ph-grad-btn-bg inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-medium text-white shadow-glow-purple-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Opening checkout…" : "Upgrade to Pro"}
                    {!loading && <ArrowRight />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <p className="mx-auto mt-6 max-w-[600px] rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-[13px] text-red-300">
              {error}
            </p>
          )}

          <p className="mt-10 text-center text-[12px] text-white/40">
            Prices in USD. Powered by Stripe. We never store your card details.
          </p>
        </section>
      </main>
    </>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-white/85">
      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />
      <span>{children}</span>
    </li>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  let plan: "free" | "pro" = "free";
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
      },
    });
    if (
      u &&
      isProActive({
        plan: u.plan,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionCurrentPeriodEnd: u.subscriptionCurrentPeriodEnd,
        email: u.email,
      })
    ) {
      plan = "pro";
    }
  }

  return {
    props: {
      signedIn: Boolean(userId),
      plan,
      showCanceledNotice: ctx.query.canceled === "1",
    },
  };
};

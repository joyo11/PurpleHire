import Head from "next/head";
import Link from "next/link";
import {
  PHLogo,
  PHButton,
  PHEyebrow,
  PHMockPanel,
  ArrowRight,
  ChevronRight,
} from "@/components/ph";

const STEPS = [
  {
    n: "01",
    t: "Paste the JD",
    d: "We parse the role, must-haves, and nice-to-haves automatically.",
  },
  {
    n: "02",
    t: "We run interviews",
    d: "PurpleHire chats with every applicant — empathetic, on-brief, never robotic.",
  },
  {
    n: "03",
    t: "Email the top 5%",
    d: "Sorted by fit score with reasoning. One click sends a next-round invite to anyone scoring 8+.",
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>PurpleHire — AI interviews for any job description</title>
        <meta
          name="description"
          content="Paste the JD. PurpleHire interviews every applicant, scores them honestly, and hands you the top 5%."
        />
      </Head>

      <main className="ph-radial-purple relative min-h-screen text-white">
        {/* NAV */}
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6 lg:px-12">
          <PHLogo size="md" />
          <nav className="flex items-center gap-2 text-[14px] text-white/70 sm:gap-6">
            <Link
              href="/pricing"
              className="hidden text-white/85 transition-colors hover:text-white sm:inline-block"
            >
              Pricing
            </Link>
            <Link
              href="/signin"
              className="hidden text-white/85 transition-colors hover:text-white sm:inline-block"
            >
              Sign in
            </Link>
            <Link href="/signin">
              <PHButton size="sm" iconRight={<ChevronRight />}>
                Get started
              </PHButton>
            </Link>
          </nav>
        </header>

        {/* HERO */}
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pb-24 lg:pt-20">
          <div className="flex flex-col justify-center lg:col-span-7">
            <div className="animate-fm-fade-up">
              <PHEyebrow live>AI recruiter · live</PHEyebrow>
            </div>

            <h1
              className="mt-6 animate-fm-fade-up text-[44px] font-medium leading-[1.02] tracking-[-0.025em] sm:mt-7 sm:text-[64px] lg:text-[88px] lg:leading-[0.98] lg:tracking-[-0.03em]"
              style={{ animationDelay: "60ms" }}
            >
              AI interviews
              <br className="hidden sm:block" />{" "}
              for <span className="ph-grad-text">any</span>{" "}
              <br className="hidden sm:block" />
              job description.
            </h1>

            <p
              className="mt-5 max-w-[540px] animate-fm-fade-up text-[15px] leading-relaxed text-white/65 sm:mt-7 sm:text-[18px]"
              style={{ animationDelay: "120ms" }}
            >
              Paste the JD. PurpleHire interviews every applicant, scores them
              honestly, and hands you the top 5% — usually before lunch.
            </p>

            <div
              className="mt-7 flex flex-col gap-2 animate-fm-fade-up sm:mt-9 sm:flex-row sm:items-center sm:gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <Link href="/signin">
                <PHButton size="lg" iconRight={<ArrowRight />}>
                  Sign in to get started
                </PHButton>
              </Link>
              <Link href="/demo">
                <PHButton size="lg" variant="ghost">
                  Try a sample interview
                </PHButton>
              </Link>
            </div>

          </div>

          <div className="flex items-center lg:col-span-5">
            <div
              className="w-full animate-fm-fade-up"
              style={{ animationDelay: "300ms" }}
            >
              <PHMockPanel />
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="relative overflow-hidden border-t border-white/10 px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 50%, rgba(147,51,234,0.10), rgba(147,51,234,0) 70%)",
            }}
          />
          <div className="relative mx-auto max-w-5xl">
            <div className="text-center">
              <div className="font-mono text-[11px] tracking-[0.16em] text-white/40">
                PRICING
              </div>
              <h2 className="mt-2 text-[28px] font-medium tracking-tight sm:text-[36px]">
                Free until you outgrow it.
              </h2>
              <p className="mx-auto mt-3 max-w-[520px] text-[14.5px] text-white/60 sm:text-[15.5px]">
                10 free completed interviews a month. Upgrade to Pro for
                unlimited. Cancel any time.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {/* FREE */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                <div className="flex items-baseline justify-between">
                  <div className="text-[16px] font-medium tracking-tight">
                    Free
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                    Start here
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-mono text-[34px] font-medium tabular-nums sm:text-[40px]">
                    $0
                  </span>
                  <span className="text-[13px] text-white/45">/month</span>
                </div>
                <ul className="mt-5 space-y-2 text-[13.5px] text-white/85">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-300" />
                    <span>
                      <strong>10 completed interviews</strong> per month
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-300" />
                    Unlimited roles
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-300" />
                    Full transcripts and AI scoring
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-300" />
                    Email candidates from your own Gmail
                  </li>
                </ul>
                <Link href="/signin" className="mt-6 block">
                  <PHButton variant="ghost" className="w-full">
                    Start free
                  </PHButton>
                </Link>
              </div>

              {/* PRO */}
              <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-500/[0.10] to-white/[0.01] p-6 shadow-glow-purple-sm sm:p-7">
                <div className="flex items-baseline justify-between">
                  <div className="text-[16px] font-medium tracking-tight">
                    Pro
                  </div>
                  <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-purple-300 ring-1 ring-inset ring-purple-500/30">
                    Recommended
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="ph-grad-text font-mono text-[34px] font-medium tabular-nums sm:text-[40px]">
                    $20
                  </span>
                  <span className="text-[13px] text-white/55">/month</span>
                </div>
                <ul className="mt-5 space-y-2 text-[13.5px] text-white/85">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-purple-300" />
                    <span>
                      <strong>Unlimited interviews</strong> every month
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-purple-300" />
                    Everything in Free
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-purple-300" />
                    Priority on the upcoming voice-mode launch
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-purple-300" />
                    Cancel any time from the customer portal
                  </li>
                </ul>
                <Link href="/pricing" className="mt-6 block">
                  <PHButton iconRight={<ArrowRight />} className="w-full">
                    Upgrade to Pro
                  </PHButton>
                </Link>
              </div>
            </div>

            <p className="mt-8 text-center text-[12px] text-white/40">
              Prices in USD. Powered by Stripe. We never store your card
              details.
            </p>
          </div>
        </section>

        {/* 3-STEP EXPLAINER */}
        <section className="border-y border-white/10 bg-black/40 px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end sm:gap-4 lg:mb-12">
              <div>
                <div className="font-mono text-[11px] tracking-[0.16em] text-white/40">
                  HOW IT WORKS
                </div>
                <h2 className="mt-2 text-[26px] font-medium tracking-tight sm:text-[36px]">
                  Three steps. About ten minutes.
                </h2>
              </div>
              <div className="text-[13px] text-white/45 sm:text-[14px]">
                No sourcing. No phone tag. No &ldquo;are you still interested?&rdquo;
              </div>
            </div>
            <div className="grid gap-3 sm:gap-5 lg:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/15 hover:bg-white/[0.04] sm:p-7"
                >
                  <div className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-gradient-to-b from-purple-400 to-purple-600 transition-transform duration-300 group-hover:scale-y-100" />
                  <div className="font-mono text-[13px] text-purple-400">
                    {s.n}
                  </div>
                  <div className="mt-4 text-[20px] font-medium tracking-tight sm:mt-5 sm:text-[22px]">
                    {s.t}
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-7 text-[12px] text-white/45 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-8 sm:text-[13px] lg:px-12">
          <PHLogo size="sm" />
          <div className="flex items-center gap-5 sm:gap-6">
            <a className="hover:text-white/70">Privacy</a>
            <a className="hover:text-white/70">Terms</a>
            <a className="hover:text-white/70">Contact</a>
            <span className="font-mono text-white/30">© 2026 PurpleHire</span>
          </div>
        </footer>
      </main>
    </>
  );
}

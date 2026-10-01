import Head from "next/head";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
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
    t: "Paste the job description",
    d: "PurpleHire reads the role and pulls out the must-haves, nice-to-haves, and the competencies worth testing.",
  },
  {
    n: "02",
    t: "Review the interview plan",
    d: "It drafts the questions and what to look for in each answer. Edit anything before it goes live, you stay in control.",
  },
  {
    n: "03",
    t: "Share one link",
    d: "Send a single interview link to every applicant. They just enter their name, no account or scheduling needed.",
  },
  {
    n: "04",
    t: "AI interviews every candidate",
    d: "A real, adaptive conversation. It asks useful follow-ups and decides on its own when it has enough to judge fairly.",
  },
  {
    n: "05",
    t: "Get an evidence-based report",
    d: "Each candidate gets a 1-10 score with a competency breakdown, strengths, concerns, and quotes from the interview.",
  },
  {
    n: "06",
    t: "Review and shortlist",
    d: "Sort by fit, skim the report, shortlist or reject. One click emails your strongest candidates about next steps.",
  },
];

export default function Home() {
  const { data: session } = useSession();
  const signedIn = !!session?.user;
  const avatarInitial =
    (session?.user?.name || session?.user?.email || "A")[0]?.toUpperCase() ??
    "A";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);
  return (
    <>
      <Head>
        <title>PurpleHire: AI interviews for any job description</title>
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
            <a
              href="#how"
              className="hidden rounded-full px-3 py-1.5 text-white/85 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white active:translate-y-0 active:scale-[0.96] sm:inline-block"
            >
              How it works
            </a>
            <Link
              href="/pricing"
              className="hidden rounded-full px-3 py-1.5 text-white/85 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white active:translate-y-0 active:scale-[0.96] sm:inline-block"
            >
              Pricing
            </Link>
            {signedIn ? (
              <>
                <Link href="/dashboard">
                  <PHButton size="sm" iconRight={<ChevronRight />}>
                    Dashboard
                  </PHButton>
                </Link>
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label="Account menu"
                    aria-expanded={menuOpen}
                    className="block rounded-full transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
                  >
                    {session?.user?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={session.user.image}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15"
                      />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-purple-500/20 text-[13px] font-medium text-purple-200 ring-1 ring-white/15">
                        {avatarInitial}
                      </span>
                    )}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/12 bg-[#0d0b12] shadow-2xl animate-fm-fade-up">
                      <div className="border-b border-white/10 px-4 py-3">
                        <div className="truncate text-[13px] font-medium text-white">
                          {session?.user?.name ?? "Signed in"}
                        </div>
                        <div className="truncate text-[12px] text-white/45">
                          {session?.user?.email}
                        </div>
                      </div>
                      <Link
                        href="/dashboard"
                        className="block px-4 py-2.5 text-[13px] text-white/80 transition-colors hover:bg-white/[0.06]"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/dashboard/new"
                        className="block px-4 py-2.5 text-[13px] text-white/80 transition-colors hover:bg-white/[0.06]"
                      >
                        Create interview
                      </Link>
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="block w-full px-4 py-2.5 text-left text-[13px] text-red-300 transition-colors hover:bg-red-500/10"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="hidden rounded-full px-3 py-1.5 text-white/85 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white active:translate-y-0 active:scale-[0.96] sm:inline-block"
                >
                  Sign in
                </Link>
                <Link href="/signin">
                  <PHButton size="sm" iconRight={<ChevronRight />}>
                    Get started
                  </PHButton>
                </Link>
              </>
            )}
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
              honestly, and hands you the top 5%, usually before lunch.
            </p>

            <div
              className="mt-7 flex flex-col gap-2 animate-fm-fade-up sm:mt-9 sm:flex-row sm:items-center sm:gap-3"
              style={{ animationDelay: "180ms" }}
            >
              {signedIn ? (
                <>
                  <Link href="/dashboard/new">
                    <PHButton size="lg" iconRight={<ArrowRight />}>
                      Create interview
                    </PHButton>
                  </Link>
                  <Link href="/dashboard">
                    <PHButton size="lg" variant="ghost">
                      Go to dashboard
                    </PHButton>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/demo">
                    <PHButton size="lg" iconRight={<ArrowRight />}>
                      Try a sample interview
                    </PHButton>
                  </Link>
                  <Link href="/signin">
                    <PHButton size="lg" variant="ghost">
                      Sign in
                    </PHButton>
                  </Link>
                </>
              )}
            </div>
            <p
              className="mt-3 animate-fm-fade-up text-[13px] text-white/40"
              style={{ animationDelay: "220ms" }}
            >
              {signedIn
                ? "Welcome back. Paste a JD and PurpleHire does the rest."
                : "No signup needed to try it."}
            </p>

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

        {/* HOW IT WORKS */}
        <section
          id="how"
          className="scroll-mt-16 border-t border-white/10 bg-black/40 px-5 py-14 sm:px-8 sm:py-20 lg:px-12"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end sm:gap-4 lg:mb-12">
              <div>
                <div className="font-mono text-[11px] tracking-[0.16em] text-white/40">
                  HOW IT WORKS
                </div>
                <h2 className="mt-2 text-[26px] font-medium tracking-tight sm:text-[36px]">
                  From job description to shortlist.
                </h2>
              </div>
              <div className="max-w-[320px] text-[13px] text-white/45 sm:text-[14px]">
                You set it up once. PurpleHire interviews everyone and hands you
                the evidence. Candidates just use the link, no account needed.
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
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04] hover:shadow-[0_16px_50px_-20px_rgba(0,0,0,0.6)] sm:p-7">
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
              <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-500/[0.10] to-white/[0.01] p-6 shadow-glow-purple-sm transition-all duration-200 hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-glow-purple sm:p-7">
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
                    Priority support and early access to new features
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

        {/* SOCIAL PROOF */}
        <section className="border-t border-white/10 px-5 py-12 sm:px-8 sm:py-14 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-[12px] font-medium uppercase tracking-[0.16em] text-white/40">
              Trusted by teams and candidates at
            </p>
            <div className="relative mt-9">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2"
                style={{
                  background:
                    "radial-gradient(50% 65% at 50% 50%, rgba(147,51,234,0.18), rgba(147,51,234,0) 70%)",
                }}
              />
              <div className="relative flex flex-wrap items-center justify-center gap-x-14 gap-y-10 sm:gap-x-24">
                {[
                  { src: "/logos/columbia.png", name: "Columbia University" },
                  { src: "/logos/consult.png", name: "Consult America" },
                  { src: "/logos/elaichi.png", name: "elaichi co." },
                  { src: "/logos/devvaults.png", name: "DevVaults" },
                ].map((l) => (
                  <div
                    key={l.name}
                    className="group flex cursor-pointer flex-col items-center gap-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.src}
                      alt={l.name}
                      className="h-16 w-auto max-w-[150px] object-contain opacity-95 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:scale-105 sm:h-20"
                    />
                    <span className="whitespace-nowrap text-[13px] font-medium tracking-tight text-white/55 transition-colors duration-200 group-hover:text-white/80">
                      {l.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-10 text-center text-[14px] text-white/50">
              <span className="font-mono font-semibold text-white/85">60+</span>{" "}
              AI interviews run and scored, and counting.
            </p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-7 text-[12px] text-white/45 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-8 sm:text-[13px] lg:px-12">
          <PHLogo size="sm" />
          <div className="flex items-center gap-5 sm:gap-6">
            <a href="mailto:shafay11august@gmail.com?subject=PurpleHire%20Privacy" className="hover:text-white/70">Privacy</a>
            <a href="mailto:shafay11august@gmail.com?subject=PurpleHire%20Terms" className="hover:text-white/70">Terms</a>
            <a href="mailto:shafay11august@gmail.com?subject=PurpleHire%20Contact" className="hover:text-white/70">Contact</a>
            <span className="font-mono text-white/30">© 2026 PurpleHire</span>
          </div>
        </footer>
      </main>
    </>
  );
}

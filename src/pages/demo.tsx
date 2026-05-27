import Head from "next/head";
import Link from "next/link";
import {
  PHLogo,
  PHEyebrow,
  ChevronLeft,
  ChevronRight,
} from "@/components/ph";

export default function DemoHub() {
  return (
    <>
      <Head>
        <title>Try PurpleHire · Demo</title>
        <meta
          name="description"
          content="Play with both sides of PurpleHire — take a sample interview as a candidate, or browse the recruiter dashboard with realistic data."
        />
      </Head>
      <main className="ph-radial-purple relative min-h-screen text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-5 sm:px-8 sm:pt-6 lg:px-12">
          <Link href="/" className="flex items-center gap-2">
            <PHLogo size="md" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Home
          </Link>
        </header>

        <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-5xl place-items-center px-4 py-12 sm:px-8 sm:py-16">
          <div className="w-full">
            <div className="mb-6 flex justify-center">
              <PHEyebrow live>Try PurpleHire</PHEyebrow>
            </div>
            <h1 className="mb-3 text-center text-[34px] font-medium leading-[1.05] tracking-tight sm:text-[44px]">
              See both sides before you sign up.
            </h1>
            <p className="mx-auto mb-12 max-w-[580px] text-center text-[15px] leading-relaxed text-white/65 sm:text-[16px]">
              Take a sample interview as a candidate, or browse the recruiter
              dashboard with realistic data. No sign-in. Nothing saved.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <Link
                href="/demo/candidate"
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition-all hover:-translate-y-0.5 hover:border-white/20 sm:p-7"
              >
                <div className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-gradient-to-b from-purple-400 to-purple-600 transition-transform duration-300 group-hover:scale-y-100" />
                <div className="font-mono text-[11px] tracking-[0.16em] text-purple-400">
                  CANDIDATE SIDE
                </div>
                <div className="mt-4 text-[20px] font-medium tracking-tight sm:text-[22px]">
                  Take a sample interview
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                  Pick a role, give us a name, and have a real conversation
                  with the AI recruiter. Get scored at the end.
                </p>
                <div className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-purple-300">
                  Start the chat
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>

              <Link
                href="/demo/recruiter"
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition-all hover:-translate-y-0.5 hover:border-white/20 sm:p-7"
              >
                <div className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-gradient-to-b from-purple-400 to-purple-600 transition-transform duration-300 group-hover:scale-y-100" />
                <div className="font-mono text-[11px] tracking-[0.16em] text-purple-400">
                  RECRUITER SIDE
                </div>
                <div className="mt-4 text-[20px] font-medium tracking-tight sm:text-[22px]">
                  Browse the dashboard
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                  See a populated recruiter inbox — eight candidates with
                  scores, AI verdicts, and clickable transcripts.
                </p>
                <div className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-purple-300">
                  Open the dashboard
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            </div>

            <p className="mt-10 text-center text-[13px] text-white/55">
              Ready for the real thing?{" "}
              <Link
                href="/signin"
                className="text-purple-300 underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </>
  );
}

import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import {
  DEMO_ROLE,
  DEMO_CANDIDATES,
  getDemoCandidate,
  type DemoCandidate,
} from "@/lib/demoRecruiter";
import {
  PHLogo,
  PHAvatar,
  PHFitBadge,
  PHMessage,
  PHButton,
  Check,
  Download,
  Sparkle,
  ChevronLeft,
} from "@/components/ph";
import DemoEmailPreview from "@/components/DemoEmailPreview";

type Props = {
  candidate: DemoCandidate;
  roleTitle: string;
  roleSlug: string;
};

function MailIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 5l5.5 4 5.5-4" />
    </svg>
  );
}

function VerdictCallout({
  score,
  verdict,
}: {
  score: number | null;
  verdict: string | null;
}) {
  const tier =
    score === null
      ? "Pending"
      : score >= 8
        ? "Strong fit"
        : score >= 6
          ? "Mixed signal"
          : "Likely no";
  const tierClass =
    score === null
      ? "bg-white/10 text-white/60 ring-white/15"
      : score >= 8
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : score >= 6
          ? "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30"
          : "bg-red-500/15 text-red-300 ring-red-500/30";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-purple-500/[0.03] to-transparent p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <Sparkle className="h-3.5 w-3.5 text-purple-300" />
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-purple-300">
          AI verdict
        </div>
        <div
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tierClass}`}
        >
          {tier}
          {score !== null && (
            <span className="font-mono">{score.toFixed(1)}/10</span>
          )}
        </div>
      </div>
      <p className="text-[14px] leading-relaxed text-white/85 sm:text-[14.5px]">
        {verdict ?? (
          <span className="italic text-white/55">
            Awaiting AI verdict — the scorer runs once the conversation
            completes.
          </span>
        )}
      </p>
    </div>
  );
}

export default function DemoTranscript({ candidate, roleTitle, roleSlug }: Props) {
  const initial = candidate.letter;
  const conversationStatus =
    candidate.status === "completed"
      ? `Interview complete · ${candidate.endReason ?? "completed"}`
      : "Interview in progress";

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);

  return (
    <>
      <Head>
        <title>
          {candidate.name} · Demo · PurpleHire
        </title>
      </Head>
      <main className="ph-radial-purple relative min-h-screen text-white">
        <div className="border-b border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-center text-[13px] text-purple-200 sm:px-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-purple-300">
            Demo
          </span>{" "}
          · Hardcoded conversation.{" "}
          <Link
            href="/signin"
            className="font-medium text-white underline-offset-2 hover:underline"
          >
            Sign in to do this with your own JD →
          </Link>
        </div>

        <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 sm:px-8">
          <Link href="/" aria-label="PurpleHire home">
            <PHLogo size="md" />
          </Link>
          <Link
            href={`/demo/recruiter`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to candidates
          </Link>
        </header>

        {/* Sticky condensed header */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[840px] items-center gap-3 px-5 py-2.5 sm:px-8 sm:py-3 lg:px-12">
            <PHAvatar letter={initial} size="sm" />
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-[13px] font-medium sm:text-[14px]">
                {candidate.name}
              </div>
              {candidate.score !== null && (
                <PHFitBadge score={candidate.score} />
              )}
            </div>
            <div className="ml-auto hidden text-[11px] text-white/45 sm:block">
              {roleTitle}
            </div>
          </div>
        </div>

        <section className="mx-auto max-w-[840px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <Link
            href={`/demo/recruiter`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft />
            Back to candidates
          </Link>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <PHAvatar letter={initial} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-medium tracking-tight sm:text-[24px]">
                  {candidate.name}
                </h1>
                {candidate.score !== null && (
                  <PHFitBadge score={candidate.score} />
                )}
              </div>
              <div className="mt-1 truncate text-[12px] text-white/45 sm:text-[13px]">
                {candidate.email} · Interviewed{" "}
                {new Date(candidate.createdAt).toLocaleDateString()} ·{" "}
                {roleTitle}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              {candidate.score !== null && candidate.score >= 8.0 && (
                <button
                  type="button"
                  onClick={() => setEmailPreviewOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-[13px] font-medium text-emerald-300 transition-all hover:-translate-y-px hover:bg-emerald-500/20"
                  title="Preview the next-round email"
                >
                  <MailIcon />
                  Send next-round email
                </button>
              )}
              <PHButton variant="ghost" size="sm" icon={<Download />}>
                Export
              </PHButton>
              <PHButton size="sm" icon={<Check />}>
                Mark reviewed
              </PHButton>
            </div>
          </div>

          <div className="mt-5 sm:mt-6">
            <VerdictCallout score={candidate.score} verdict={candidate.verdict} />
          </div>

          {/* Transcript */}
          <section className="mt-8 sm:mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-medium tracking-tight text-white/80">
                Transcript
              </h2>
              <div className="font-mono text-[11px] text-white/40">
                {candidate.transcript.length} messages
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {candidate.transcript.map((m, i) => (
                <div
                  key={i}
                  className="animate-fm-fade-up"
                  style={{
                    animationDelay: `${Math.min(i, 12) * 30}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <PHMessage from={m.role === "user" ? "candidate" : "bot"}>
                    {m.content}
                  </PHMessage>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-white/55">
              <Check className="h-3.5 w-3.5 text-emerald-300" />
              {conversationStatus}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="mt-10 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-purple-500/[0.03] to-transparent p-6 text-center">
            <h2 className="text-[20px] font-medium tracking-tight">
              Like what you see?
            </h2>
            <p className="mx-auto mt-2 max-w-[480px] text-[14px] text-white/65">
              Paste your own JD and PurpleHire will run interviews like this
              for every applicant, automatically.
            </p>
            <div className="mt-5">
              <Link href="/signin">
                <PHButton size="lg">Sign in to get started</PHButton>
              </Link>
            </div>
          </section>

          <p className="sr-only">{roleSlug}</p>
        </section>
      </main>

      <DemoEmailPreview
        open={emailPreviewOpen}
        onClose={() => setEmailPreviewOpen(false)}
        candidate={{ name: candidate.name, email: candidate.email }}
        roleTitle={roleTitle}
      />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: DEMO_CANDIDATES.map((c) => ({ params: { id: c.id } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const id = ctx.params?.id;
  if (typeof id !== "string") return { notFound: true };
  const candidate = getDemoCandidate(id);
  if (!candidate) return { notFound: true };
  return {
    props: {
      candidate,
      roleTitle: DEMO_ROLE.title,
      roleSlug: DEMO_ROLE.slug,
    },
  };
};

import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildNextRoundMailto } from "@/lib/inviteEmail";
import { parseReport } from "@/lib/evaluationReport";
import OverallResult from "@/components/report/OverallResult";
import CompetencyBreakdown from "@/components/report/CompetencyBreakdown";
import StrengthsConcerns from "@/components/report/StrengthsConcerns";
import EvidenceList from "@/components/report/EvidenceList";
import PerQuestionList from "@/components/report/PerQuestionList";
import ScoreExplainer from "@/components/ScoreExplainer";
import { aiAssistRisk, riskLabel, riskBadgeClasses } from "@/lib/proctoring";
import {
  PHTopBar,
  PHAvatar,
  PHFitBadge,
  PHMessage,
  PHButton,
  Check,
  Download,
  Sparkle,
  ChevronLeft,
} from "@/components/ph";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  candidate: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    score: number | null;
    verdict: string | null;
    reviewedAt: string | null;
    decision: string | null;
    report: string | null;
  };
  role: { slug: string; title: string };
  conversation: {
    status: string;
    endReason: string | null;
    tabSwitches: number;
    pasteCount: number;
  } | null;
  messages: Msg[];
};

function firstInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

const DECISION_META: Record<
  string,
  { label: string; badge: string; active: string }
> = {
  shortlisted: {
    label: "Shortlisted",
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    badge: "bg-red-500/15 text-red-300 ring-red-500/30",
    active: "border-red-500/40 bg-red-500/15 text-red-300",
  },
  maybe: {
    label: "Maybe",
    badge: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
    active: "border-yellow-500/40 bg-yellow-500/15 text-yellow-300",
  },
};

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const meta = DECISION_META[decision];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${meta.badge}`}
    >
      {meta.label}
    </span>
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
          ? "Solid, leaning yes"
          : score >= 4
            ? "Mixed signal"
            : "Likely no";
  const tierClass =
    score === null
      ? "bg-white/10 text-white/60 ring-white/15"
      : score >= 8
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : score >= 6
          ? "bg-teal-500/15 text-teal-300 ring-teal-500/30"
          : score >= 4
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
            Awaiting AI verdict. The scorer runs once the conversation
            completes.
          </span>
        )}
      </p>
    </div>
  );
}

export default function Transcript({
  user,
  candidate,
  role,
  conversation,
  messages,
}: Props) {
  const initial = firstInitial(candidate.name);
  const report = parseReport(candidate.report);
  const [reviewed, setReviewed] = useState(!!candidate.reviewedAt);
  const [savingReview, setSavingReview] = useState(false);
  const [decision, setDecision] = useState<string | null>(candidate.decision);
  const [savingDecision, setSavingDecision] = useState(false);

  async function toggleReviewed() {
    if (savingReview) return;
    const next = !reviewed;
    setSavingReview(true);
    setReviewed(next); // optimistic
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: next }),
      });
      if (!res.ok) setReviewed(!next); // revert on failure
    } catch {
      setReviewed(!next);
    } finally {
      setSavingReview(false);
    }
  }

  async function chooseDecision(next: string) {
    if (savingDecision) return;
    const value = decision === next ? null : next;
    const prev = decision;
    setDecision(value); // optimistic
    setSavingDecision(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: value }),
      });
      if (!res.ok) setDecision(prev); // revert on failure
    } catch {
      setDecision(prev); // rollback
    } finally {
      setSavingDecision(false);
    }
  }

  function exportTranscript() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Speaker", "Message", "Time"];
    const rows = messages.map((m) =>
      [
        m.role === "user" ? candidate.name : "Interviewer",
        m.content,
        new Date(m.createdAt).toLocaleString(),
      ]
        .map((cell) => esc(String(cell)))
        .join(","),
    );
    const csv = [header.map(esc).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = candidate.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `${role.slug}-${safeName}-transcript.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const conversationStatus =
    conversation?.status === "completed"
      ? `Interview complete · ${conversation.endReason ?? "completed"}`
      : "Interview in progress";

  return (
    <>
      <Head>
        <title>
          {candidate.name} · {role.title}
        </title>
      </Head>
      <main className="ph-radial-purple relative min-h-screen text-white">
        <PHTopBar
          user={{
            email: user.email,
            image: user.image,
            letter: user.name?.[0]?.toUpperCase() ?? "A",
          }}
          onSignOut={() => signOut({ callbackUrl: "/signin" })}
        />

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
              {role.title}
            </div>
          </div>
        </div>

        <section className="mx-auto max-w-[840px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <Link
            href={`/dashboard/${role.slug}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft />
            Back to role
          </Link>

          {/* Full header */}
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
                {conversation && conversation.tabSwitches > 0 && (
                  <span
                    title="Times the candidate left the interview tab"
                    className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] font-medium text-yellow-300 ring-1 ring-inset ring-yellow-500/30"
                  >
                    ⚠ Left tab {conversation.tabSwitches}×
                  </span>
                )}
                {conversation &&
                  (() => {
                    const risk = aiAssistRisk({
                      tabSwitches: conversation.tabSwitches,
                      pasteCount: conversation.pasteCount,
                    });
                    if (risk === "low") return null;
                    return (
                      <span
                        title={`${conversation.pasteCount} large paste(s), ${conversation.tabSwitches} tab leave(s). A hint, not a verdict.`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${riskBadgeClasses(risk)}`}
                      >
                        {riskLabel(risk)}
                      </span>
                    );
                  })()}
                {reviewed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                    ✓ Reviewed
                  </span>
                )}
                <DecisionBadge decision={decision} />
              </div>
              <div className="mt-1 truncate text-[12px] text-white/45 sm:text-[13px]">
                {candidate.email} · Interviewed{" "}
                {new Date(candidate.createdAt).toLocaleDateString()} ·{" "}
                {role.title}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              {candidate.score !== null && candidate.score >= 8.0 && (
                <a
                  href={buildNextRoundMailto({
                    candidate: { name: candidate.name, email: candidate.email },
                    roleTitle: role.title,
                    recruiterFirstName: user.name?.split(" ")[0] ?? null,
                  })}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-[13px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
                    <path d="M2.5 5l5.5 4 5.5-4" />
                  </svg>
                  Send next-round email
                </a>
              )}
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
                {(["shortlisted", "maybe", "rejected"] as const).map((key) => {
                  const meta = DECISION_META[key];
                  const active = decision === key;
                  return (
                    <button
                      key={key}
                      onClick={() => chooseDecision(key)}
                      disabled={savingDecision}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                        active
                          ? `border ${meta.active}`
                          : "border border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                      title={active ? `Clear ${meta.label.toLowerCase()}` : meta.label}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <PHButton
                variant="ghost"
                size="sm"
                icon={<Download />}
                onClick={exportTranscript}
              >
                Export
              </PHButton>
              <PHButton
                size="sm"
                variant={reviewed ? "secondary" : "ghost"}
                icon={<Check />}
                onClick={toggleReviewed}
                disabled={savingReview}
              >
                {reviewed ? "Reviewed" : "Mark reviewed"}
              </PHButton>
            </div>
          </div>

          {report ? (
            <div className="mt-5 flex flex-col gap-4 sm:mt-6">
              <OverallResult report={report} score={candidate.score} />
              <CompetencyBreakdown report={report} />
              <StrengthsConcerns report={report} />
              <EvidenceList report={report} />
              <PerQuestionList report={report} />
            </div>
          ) : (
            <>
              <div className="mt-5 sm:mt-6">
                <VerdictCallout
                  score={candidate.score}
                  verdict={candidate.verdict}
                />
              </div>
              <div className="mt-3">
                <ScoreExplainer />
              </div>
            </>
          )}

          {/* Transcript */}
          <section className="mt-8 sm:mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-medium tracking-tight text-white/80">
                Transcript
              </h2>
              <div className="font-mono text-[11px] text-white/40">
                {messages.length} messages
              </div>
            </div>

            {messages.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-[13px] text-white/50">
                No messages yet.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m, i) => (
                  <div
                    key={m.id}
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
            )}

            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-white/55">
              <Check className="h-3.5 w-3.5 text-emerald-300" />
              {conversationStatus}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const slug = ctx.params?.slug;
  const candidateId = ctx.params?.candidateId;
  if (typeof slug !== "string" || typeof candidateId !== "string") {
    return { notFound: true };
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      role: true,
      conversations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { messages: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (
    !candidate ||
    candidate.role.slug !== slug ||
    candidate.role.recruiterId !== userId
  ) {
    return { notFound: true };
  }

  const conv = candidate.conversations[0] ?? null;

  return {
    props: {
      user: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        createdAt: candidate.createdAt.toISOString(),
        score: candidate.score,
        verdict: candidate.verdict,
        reviewedAt: candidate.reviewedAt
          ? candidate.reviewedAt.toISOString()
          : null,
        decision: candidate.decision,
        report: candidate.report ?? null,
      },
      role: { slug: candidate.role.slug, title: candidate.role.title },
      conversation: conv
        ? {
            status: conv.status,
            endReason: conv.endReason,
            tabSwitches: conv.tabSwitches,
            pasteCount: conv.pasteCount,
          }
        : null,
      messages:
        conv?.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })) ?? [],
    },
  };
};

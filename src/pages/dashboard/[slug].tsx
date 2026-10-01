import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildNextRoundMailto } from "@/lib/inviteEmail";
import {
  parseReport,
  recommendationFromScore,
  type Recommendation,
} from "@/lib/evaluationReport";
import {
  PHTopBar,
  PHButton,
  PHPill,
  PHFitBadge,
  PHAvatar,
  PHInput,
  PHTextarea,
  Copy,
  Check,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
} from "@/components/ph";

type CandidateRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  score: number | null;
  verdict: string | null;
  report: string | null;
  status: "in_progress" | "completed" | "no_conversation";
  endReason: string | null;
  mode: "chat" | "voice";
  decision: string | null;
  reviewedAt: string | null;
};

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  role: {
    id: string;
    slug: string;
    title: string;
    jdText: string;
    interviewPlan: string;
    createdAt: string;
  };
  baseUrl: string;
  candidates: CandidateRow[];
};

const PASS_THRESHOLD = 8.0;

function MailIcon({ className = "h-3 w-3" }: { className?: string }) {
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

function TrashIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <path d="M3 4h10M6 4V2.5h4V4M5 4l.6 9a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9L11 4" />
    </svg>
  );
}

type FilterKey = "all" | "completed" | "in_progress";
type DecisionFilterKey = "all" | "shortlisted" | "rejected" | "maybe" | "undecided";
type SortKey = "score" | "recency";

function firstInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

/** When the candidate took the interview, e.g. "26 May 2026, 3:42 PM". */
function formatInterviewDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

const DECISION_META: Record<string, { label: string; badge: string }> = {
  shortlisted: {
    label: "Shortlisted",
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  rejected: {
    label: "Rejected",
    badge: "bg-red-500/15 text-red-300 ring-red-500/30",
  },
  maybe: {
    label: "Maybe",
    badge: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
  },
};

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const meta = DECISION_META[decision];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${meta.badge}`}
    >
      {meta.label}
    </span>
  );
}

const REC_META: Record<Recommendation, string> = {
  "Strong match": "text-emerald-300",
  "Possible match": "text-teal-300",
  "Weak match": "text-yellow-300",
  "Not enough evidence": "text-white/40",
};

/** The recommendation label for a candidate: prefer the stored report's own
 *  recommendation, else derive it from the numeric score. */
function recommendationFor(c: CandidateRow): Recommendation {
  const report = parseReport(c.report);
  return report?.recommendation ?? recommendationFromScore(c.score);
}

function RecommendationCell({ c }: { c: CandidateRow }) {
  if (c.status === "in_progress") {
    return <span className="text-[12px] italic text-white/35">Pending</span>;
  }
  const rec = recommendationFor(c);
  return (
    <span className={`text-[12.5px] font-medium ${REC_META[rec]}`}>{rec}</span>
  );
}

function StatusCell({ c }: { c: CandidateRow }) {
  if (c.decision) {
    return <DecisionBadge decision={c.decision} />;
  }
  if (c.status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-purple-300">
        <span className="h-1.5 w-1.5 animate-fm-pulse-dot rounded-full bg-purple-500" />
        In progress
      </span>
    );
  }
  const report = parseReport(c.report);
  if (report?.incomplete || (c.status === "completed" && c.score === null)) {
    return (
      <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-medium text-white/60 ring-1 ring-inset ring-white/15">
        Incomplete
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[10.5px] font-medium text-purple-200 ring-1 ring-inset ring-purple-500/25">
      Needs review
    </span>
  );
}

/** One "item per line" text block parsed into a trimmed string array. */
function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** The interview plan stored on the role. Known fields are the ones the
 *  scorer + interview prompt read; any extra keys are preserved on save. */
type PlanShape = {
  summary?: string;
  must_haves?: string[];
  nice_to_haves?: string[];
  skills_to_probe?: string[];
  red_flags?: string[];
  [key: string]: unknown;
};

function parsePlan(raw: string): PlanShape {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as PlanShape;
    }
  } catch {
    // fall through
  }
  return {};
}

function planArray(plan: PlanShape, key: string): string[] {
  const v = plan[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Trim the key signal to a readable length without cutting mid-word too
 *  aggressively. */
function truncateSignal(text: string, max = 96): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Score cell: X.X badge for a scored candidate, an "ongoing" marker while the
 *  interview runs, else "Incomplete". */
function ScoreCell({ c }: { c: CandidateRow }) {
  if (c.status === "completed" && c.score !== null) {
    return <PHFitBadge score={c.score} animated />;
  }
  if (c.status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-purple-300">
        <span className="h-1.5 w-1.5 animate-fm-pulse-dot rounded-full bg-purple-500" />
        ongoing
      </span>
    );
  }
  return (
    <span className="font-mono text-[12px] text-white/40">Incomplete</span>
  );
}

/** Key signal cell: the report headline, gracefully truncated. */
function KeySignalCell({ c }: { c: CandidateRow }) {
  const report = parseReport(c.report);
  const signal = report?.keySignal?.trim();
  if (signal) {
    return (
      <span
        className="block text-[13px] leading-relaxed text-white/65 line-clamp-2"
        title={signal}
      >
        {truncateSignal(signal)}
      </span>
    );
  }
  return (
    <span className="text-[12.5px] italic text-white/35">
      {c.status === "in_progress" ? "Interview in progress" : "No signal yet"}
    </span>
  );
}

export default function RoleDetail({
  user,
  role,
  baseUrl,
  candidates: initialCandidates,
}: Props) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateRow[]>(initialCandidates);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilterKey>("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedJd, setCopiedJd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Edit role (JD + interview plan) ---
  const initialPlan = useMemo(() => parsePlan(role.interviewPlan), [role.interviewPlan]);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(role.title);
  const [editJd, setEditJd] = useState(role.jdText);
  const [editSummary, setEditSummary] = useState(initialPlan.summary ?? "");
  const [editMustHaves, setEditMustHaves] = useState(
    planArray(initialPlan, "must_haves").join("\n"),
  );
  const [editNiceToHaves, setEditNiceToHaves] = useState(
    planArray(initialPlan, "nice_to_haves").join("\n"),
  );
  const [editCompetencies, setEditCompetencies] = useState(
    planArray(initialPlan, "skills_to_probe").join("\n"),
  );
  const [editQuestions, setEditQuestions] = useState(
    planArray(initialPlan, "red_flags").join("\n"),
  );

  function openEditor() {
    setEditError(null);
    setEditTitle(role.title);
    setEditJd(role.jdText);
    setEditSummary(initialPlan.summary ?? "");
    setEditMustHaves(planArray(initialPlan, "must_haves").join("\n"));
    setEditNiceToHaves(planArray(initialPlan, "nice_to_haves").join("\n"));
    setEditCompetencies(planArray(initialPlan, "skills_to_probe").join("\n"));
    setEditQuestions(planArray(initialPlan, "red_flags").join("\n"));
    setEditing(true);
  }

  async function saveEdit() {
    if (!editTitle.trim()) {
      setEditError("Title cannot be empty.");
      return;
    }
    if (!editJd.trim()) {
      setEditError("Job description cannot be empty.");
      return;
    }
    // Preserve any unknown plan keys; override the fields we edit.
    const nextPlan: PlanShape = {
      ...initialPlan,
      summary: editSummary.trim(),
      must_haves: linesToArray(editMustHaves),
      nice_to_haves: linesToArray(editNiceToHaves),
      skills_to_probe: linesToArray(editCompetencies),
      red_flags: linesToArray(editQuestions),
    };
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          jdText: editJd.trim(),
          interviewPlan: nextPlan,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || "Could not save changes. Try again.");
        return;
      }
      setEditing(false);
      // Re-run getServerSideProps so the page reflects the saved role.
      router.replace(router.asPath, undefined, { scroll: false });
    } catch {
      setEditError("Network error. Try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteCandidate(c: CandidateRow) {
    if (!confirm(`Delete ${c.name}'s interview and transcript permanently?`))
      return;
    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/candidates/${c.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete the candidate.");
        return;
      }
      setCandidates((cs) => cs.filter((x) => x.id !== c.id));
    } catch {
      alert("Network error. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const link = `${baseUrl}/i/${role.slug}`;
  const linkShort = `/i/${role.slug}`;

  const completedCount = candidates.filter((c) => c.status === "completed").length;
  const inProgressCount = candidates.filter((c) => c.status === "in_progress").length;

  const shortlistedCount = candidates.filter((c) => c.decision === "shortlisted").length;
  const rejectedCount = candidates.filter((c) => c.decision === "rejected").length;
  const maybeCount = candidates.filter((c) => c.decision === "maybe").length;
  const undecidedCount = candidates.filter((c) => !c.decision).length;

  const filtered = useMemo(() => {
    let list = candidates.slice();
    if (filter === "completed") list = list.filter((c) => c.status === "completed");
    if (filter === "in_progress")
      list = list.filter((c) => c.status === "in_progress");
    if (decisionFilter === "undecided") list = list.filter((c) => !c.decision);
    else if (decisionFilter !== "all")
      list = list.filter((c) => c.decision === decisionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.verdict?.toLowerCase().includes(q) ?? false),
      );
    }
    list.sort((a, b) => {
      if (sort === "score") {
        const av = a.score ?? -1;
        const bv = b.score ?? -1;
        return bv - av;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [candidates, filter, decisionFilter, sort, search]);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyJd() {
    await navigator.clipboard.writeText(role.jdText);
    setCopiedJd(true);
    setTimeout(() => setCopiedJd(false), 1500);
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Name", "Email", "Score", "Verdict", "Date"];
    const rows = filtered.map((c) =>
      [
        c.name,
        c.email,
        c.score === null ? "" : c.score.toFixed(1),
        c.verdict ?? "",
        new Date(c.createdAt).toLocaleDateString(),
      ]
        .map((cell) => esc(String(cell)))
        .join(","),
    );
    const csv = [header.map(esc).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${role.slug}-candidates.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Head>
        <title>{role.title} · PurpleHire</title>
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

        <section className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All interviews
          </Link>

          <header className="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono text-[11px] tracking-[0.16em] text-white/40">
                ROLE
              </div>
              <h1 className="mt-2 text-[26px] font-medium tracking-tight sm:text-[34px]">
                {role.title}
              </h1>
              <div className="mt-2 text-[13px] text-white/45 sm:text-[14px]">
                Created {new Date(role.createdAt).toLocaleDateString()} ·{" "}
                {candidates.length} candidate
                {candidates.length === 1 ? "" : "s"} · {inProgressCount}{" "}
                ongoing
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <PHButton variant="ghost" size="sm" onClick={openEditor}>
                Edit role
              </PHButton>
              <PHButton
                variant="ghost"
                size="sm"
                icon={<Download />}
                onClick={exportCsv}
              >
                Export
              </PHButton>
            </div>
          </header>

          {/* SHARE LINK */}
          <section className="mt-5 flex flex-col items-stretch gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.005] p-4 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-500/15 text-purple-300">
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4L8 4" />
                  <path d="M9 7a3 3 0 0 0-4 0l-2 2a3 3 0 0 0 4 4l1-1" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] text-white/45">
                  Candidate interview link
                </div>
                <div className="truncate font-mono text-[13px] text-white/85">
                  {linkShort}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 sm:hidden">
              <PHButton variant="ghost" size="sm" onClick={openEditor}>
                Edit role
              </PHButton>
              <PHButton
                onClick={copyLink}
                size="sm"
                icon={copied ? <Check /> : <Copy />}
              >
                {copied ? "Copied" : "Copy candidate link"}
              </PHButton>
            </div>
            <div className="hidden items-center justify-end gap-2 sm:flex">
              <PHButton
                onClick={copyLink}
                size="sm"
                icon={copied ? <Check /> : <Copy />}
              >
                {copied ? "Copied" : "Copy candidate link"}
              </PHButton>
            </div>
          </section>

          {/* FILTER + SORT */}
          <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
                <PHPill
                  active={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  All{" "}
                  <span className="ml-1 font-mono text-[11px] text-white/40">
                    {candidates.length}
                  </span>
                </PHPill>
                <PHPill
                  active={filter === "completed"}
                  onClick={() => setFilter("completed")}
                >
                  Completed{" "}
                  <span className="ml-1 font-mono text-[11px] text-white/40">
                    {completedCount}
                  </span>
                </PHPill>
                <PHPill
                  active={filter === "in_progress"}
                  onClick={() => setFilter("in_progress")}
                >
                  In progress{" "}
                  <span className="ml-1 font-mono text-[11px] text-white/40">
                    {inProgressCount}
                  </span>
                </PHPill>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-white/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by name or verdict"
                  className="w-[180px] bg-transparent text-[13px] text-white placeholder:text-white/35 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={() => setSort(sort === "score" ? "recency" : "score")}
              className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-[13px] text-white/75 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              Sort:{" "}
              <span className="font-medium text-white">
                {sort === "score" ? "Score" : "Recency"}
              </span>
              <ChevronDown className="text-white/45" />
            </button>
          </section>

          {/* DECISION FILTER */}
          <section className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.02] p-1">
              <PHPill
                active={decisionFilter === "all"}
                onClick={() => setDecisionFilter("all")}
              >
                All decisions
              </PHPill>
              <PHPill
                active={decisionFilter === "shortlisted"}
                onClick={() => setDecisionFilter("shortlisted")}
              >
                Shortlisted{" "}
                <span className="ml-1 font-mono text-[11px] text-white/40">
                  {shortlistedCount}
                </span>
              </PHPill>
              <PHPill
                active={decisionFilter === "rejected"}
                onClick={() => setDecisionFilter("rejected")}
              >
                Rejected{" "}
                <span className="ml-1 font-mono text-[11px] text-white/40">
                  {rejectedCount}
                </span>
              </PHPill>
              <PHPill
                active={decisionFilter === "maybe"}
                onClick={() => setDecisionFilter("maybe")}
              >
                Maybe{" "}
                <span className="ml-1 font-mono text-[11px] text-white/40">
                  {maybeCount}
                </span>
              </PHPill>
              <PHPill
                active={decisionFilter === "undecided"}
                onClick={() => setDecisionFilter("undecided")}
              >
                Undecided{" "}
                <span className="ml-1 font-mono text-[11px] text-white/40">
                  {undecidedCount}
                </span>
              </PHPill>
            </div>
            <div className="text-[12px] text-white/45">
              <span className="text-emerald-300">{shortlistedCount} shortlisted</span>
              {" · "}
              {maybeCount} maybe · {rejectedCount} rejected
            </div>
          </section>

          {/* CANDIDATES */}
          {filtered.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.01] p-12 text-center text-[14px] text-white/50">
              {candidates.length === 0
                ? "No one's taken this interview yet. Share the link above to your candidates."
                : "No candidates match the current filters."}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <section className="mt-5 hidden overflow-hidden rounded-3xl border border-white/10 lg:block">
                <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[11px] uppercase tracking-[0.14em] text-white/40">
                  <div className="col-span-3">Candidate</div>
                  <div className="col-span-1">Score</div>
                  <div className="col-span-2">Recommendation</div>
                  <div className="col-span-2">Key signal</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className="group relative grid grid-cols-12 items-center gap-4 border-b border-white/5 px-6 py-4 transition-all last:border-b-0 hover:bg-white/[0.025]"
                  >
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] origin-left scale-x-0 bg-gradient-to-b from-purple-400 to-purple-600 transition-transform duration-200 group-hover:scale-x-100" />
                    <div className="col-span-3 flex items-center gap-3">
                      <PHAvatar letter={firstInitial(c.name)} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-[14.5px] font-medium text-white">
                          {c.name}
                          {c.mode === "voice" && <VoiceBadge />}
                        </div>
                        <div className="truncate text-[12px] text-white/45">
                          {c.email}
                        </div>
                        <div className="truncate text-[11px] text-white/35">
                          Interviewed {formatInterviewDateTime(c.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <ScoreCell c={c} />
                    </div>
                    <div className="col-span-2">
                      <RecommendationCell c={c} />
                    </div>
                    <div className="col-span-2">
                      <KeySignalCell c={c} />
                    </div>
                    <div className="col-span-2">
                      <StatusCell c={c} />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      {c.score !== null && c.score >= PASS_THRESHOLD && (
                        <a
                          href={buildNextRoundMailto({
                            candidate: { name: c.name, email: c.email },
                            roleTitle: role.title,
                            recruiterFirstName: user.name?.split(" ")[0] ?? null,
                          })}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] text-emerald-300 transition-colors hover:bg-emerald-500/20"
                          title="Send next-round email"
                        >
                          <MailIcon />
                          Email
                        </a>
                      )}
                      <Link
                        href={`/dashboard/${role.slug}/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        View report
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                      <button
                        onClick={() => deleteCandidate(c)}
                        disabled={deletingId === c.id}
                        title="Delete candidate"
                        className="grid h-7 w-7 place-items-center rounded-full text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </section>

              {/* Mobile cards */}
              <ul className="mt-4 flex flex-col gap-2 lg:hidden">
                {filtered.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/${role.slug}/${c.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <PHAvatar letter={firstInitial(c.name)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                            {c.name}
                            {c.mode === "voice" && <VoiceBadge />}
                          </div>
                          <div className="truncate text-[11px] text-white/45">
                            {c.email}
                          </div>
                          <div className="truncate text-[10.5px] text-white/35">
                            {formatInterviewDateTime(c.createdAt)}
                          </div>
                        </div>
                      </Link>
                      <ScoreCell c={c} />
                      <button
                        onClick={() => deleteCandidate(c)}
                        disabled={deletingId === c.id}
                        className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                        aria-label="Delete candidate"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <RecommendationCell c={c} />
                      <StatusCell c={c} />
                    </div>
                    <div className="mt-2">
                      <KeySignalCell c={c} />
                    </div>
                    <Link
                      href={`/dashboard/${role.slug}/${c.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-purple-300 transition-colors hover:text-purple-200"
                    >
                      View report
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                    {c.score !== null && c.score >= PASS_THRESHOLD && (
                      <a
                        href={buildNextRoundMailto({
                          candidate: { name: c.name, email: c.email },
                          roleTitle: role.title,
                          recruiterFirstName: user.name?.split(" ")[0] ?? null,
                        })}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] text-emerald-300"
                      >
                        <MailIcon />
                        Send next-round email
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* JD CARD */}
          <section className="mt-10">
            <h2 className="mb-3 text-[14px] font-medium tracking-tight text-white/80 sm:text-[15px]">
              Job description
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 sm:px-5">
                <span className="font-mono text-[11px] text-white/40">
                  {role.slug}.md
                </span>
                <button
                  onClick={copyJd}
                  className="inline-flex items-center gap-1 text-[11px] text-white/55 transition-colors hover:text-white"
                >
                  {copiedJd ? (
                    <>
                      <Check className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap p-4 font-mono text-[12.5px] leading-relaxed text-white/70 sm:p-5">
                {role.jdText}
              </pre>
            </div>
          </section>
        </section>

        {editing && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !savingEdit) setEditing(false);
            }}
          >
            <div className="my-auto w-full max-w-[720px] rounded-3xl border border-white/10 bg-[#0f0b16] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-[16px] font-medium tracking-tight text-white">
                    Edit role
                  </h2>
                  <p className="mt-0.5 text-[12px] text-white/45">
                    Changes apply to new interviews. Completed scores are not
                    recomputed.
                  </p>
                </div>
                <button
                  onClick={() => !savingEdit && setEditing(false)}
                  disabled={savingEdit}
                  aria-label="Close editor"
                  className="grid h-8 w-8 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <PHInput
                  label="Role title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                />

                <PHTextarea
                  label="Job description"
                  value={editJd}
                  onChange={(e) => setEditJd(e.target.value)}
                  rows={8}
                  count={editJd.length}
                  countMax={20000}
                  placeholder="Paste the job description…"
                />

                <div className="rounded-2xl border border-white/10 bg-white/[0.015] p-4 sm:p-5">
                  <h3 className="text-[13px] font-medium text-white/80">
                    Interview plan
                  </h3>
                  <p className="mt-0.5 text-[12px] text-white/45">
                    One item per line. These guide what the interview probes and
                    how candidates are scored.
                  </p>
                  <div className="mt-4 space-y-4">
                    <PHTextarea
                      label="Summary"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      rows={2}
                      placeholder="One-sentence summary of the role"
                    />
                    <PHTextarea
                      label="Must-haves"
                      value={editMustHaves}
                      onChange={(e) => setEditMustHaves(e.target.value)}
                      rows={4}
                      placeholder={"Required skill or experience\nOne per line"}
                    />
                    <PHTextarea
                      label="Nice-to-haves"
                      value={editNiceToHaves}
                      onChange={(e) => setEditNiceToHaves(e.target.value)}
                      rows={4}
                      placeholder={"Bonus skill or experience\nOne per line"}
                    />
                    <PHTextarea
                      label="Competencies to probe"
                      value={editCompetencies}
                      onChange={(e) => setEditCompetencies(e.target.value)}
                      rows={4}
                      placeholder={"Topic the interview should test\nOne per line"}
                    />
                    <PHTextarea
                      label="Questions and red flags to watch"
                      value={editQuestions}
                      onChange={(e) => setEditQuestions(e.target.value)}
                      rows={4}
                      placeholder={"Signal or dealbreaker to watch for\nOne per line"}
                    />
                  </div>
                </div>

                {editError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
                    {editError}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4 sm:px-6">
                <PHButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </PHButton>
                <PHButton
                  size="sm"
                  onClick={saveEdit}
                  state={savingEdit ? "loading" : "default"}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving" : "Save changes"}
                </PHButton>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function VoiceBadge() {
  return (
    <span
      title="Voice interview"
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-purple-500/20 text-purple-200"
      aria-label="Voice interview"
    >
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
      </svg>
    </span>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const slug = ctx.params?.slug;
  if (typeof slug !== "string") return { notFound: true };

  const role = await prisma.role.findUnique({
    where: { slug },
    include: {
      candidates: {
        orderBy: { createdAt: "desc" },
        include: {
          conversations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, endReason: true, mode: true },
          },
        },
      },
    },
  });

  if (!role || role.recruiterId !== userId) {
    return { notFound: true };
  }

  const host = ctx.req.headers.host ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  return {
    props: {
      user: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
      role: {
        id: role.id,
        slug: role.slug,
        title: role.title,
        jdText: role.jdText,
        interviewPlan: role.interviewPlan,
        createdAt: role.createdAt.toISOString(),
      },
      baseUrl: `${protocol}://${host}`,
      candidates: role.candidates.map((c) => {
        const conv = c.conversations[0];
        const status: CandidateRow["status"] = !conv
          ? "no_conversation"
          : conv.status === "completed"
            ? "completed"
            : "in_progress";
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          createdAt: c.createdAt.toISOString(),
          score: c.score,
          verdict: c.verdict,
          report: c.report,
          status,
          endReason: conv?.endReason ?? null,
          mode: conv?.mode === "voice" ? "voice" as const : "chat" as const,
          decision: c.decision,
          reviewedAt: c.reviewedAt ? c.reviewedAt.toISOString() : null,
        };
      }),
    },
  };
};

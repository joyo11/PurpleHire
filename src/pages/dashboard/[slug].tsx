import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildNextRoundMailto } from "@/lib/inviteEmail";
import {
  PHTopBar,
  PHButton,
  PHPill,
  PHFitBadge,
  PHAvatar,
  Copy,
  Check,
  Download,
  Dots,
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
  status: "in_progress" | "completed" | "no_conversation";
  endReason: string | null;
};

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  role: {
    slug: string;
    title: string;
    jdText: string;
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
type SortKey = "score" | "recency";

function firstInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

export default function RoleDetail({
  user,
  role,
  baseUrl,
  candidates: initialCandidates,
}: Props) {
  const [candidates, setCandidates] = useState<CandidateRow[]>(initialCandidates);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedJd, setCopiedJd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    let list = candidates.slice();
    if (filter === "completed") list = list.filter((c) => c.status === "completed");
    if (filter === "in_progress")
      list = list.filter((c) => c.status === "in_progress");
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
  }, [candidates, filter, sort, search]);

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
              <PHButton variant="ghost" size="sm" icon={<Download />}>
                Export
              </PHButton>
              <button
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/65 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="More"
              >
                <Dots />
              </button>
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
                  Share with candidates
                </div>
                <div className="truncate font-mono text-[13px] text-white/85">
                  {linkShort}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <PHButton
                onClick={copyLink}
                size="sm"
                icon={copied ? <Check /> : <Copy />}
              >
                {copied ? "Copied" : "Copy link"}
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
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Candidate</div>
                  <div className="col-span-1">Score</div>
                  <div className="col-span-5">AI verdict</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {filtered.map((c, i) => (
                  <div
                    key={c.id}
                    className="group relative grid grid-cols-12 items-center gap-4 border-b border-white/5 px-6 py-4 transition-all last:border-b-0 hover:bg-white/[0.025]"
                  >
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] origin-left scale-x-0 bg-gradient-to-b from-purple-400 to-purple-600 transition-transform duration-200 group-hover:scale-x-100" />
                    <div className="col-span-1 font-mono text-[12px] text-white/35">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="col-span-3 flex items-center gap-3">
                      <PHAvatar letter={firstInitial(c.name)} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-medium text-white">
                          {c.name}
                        </div>
                        <div className="truncate text-[12px] text-white/45">
                          {c.email}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-1">
                      {c.status === "completed" && c.score !== null ? (
                        <PHFitBadge score={c.score} animated />
                      ) : c.status === "in_progress" ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-purple-300">
                          <span className="h-1.5 w-1.5 animate-fm-pulse-dot rounded-full bg-purple-500" />
                          ongoing
                        </span>
                      ) : (
                        <span className="font-mono text-[12px] text-white/30">
                          —
                        </span>
                      )}
                    </div>
                    <div className="col-span-5 text-[13px] leading-relaxed text-white/65 line-clamp-2">
                      {c.verdict ?? (
                        <span className="italic text-white/35">
                          {c.status === "in_progress"
                            ? "Interview in progress"
                            : "Awaiting score…"}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end gap-1.5">
                      {c.score !== null && c.score >= PASS_THRESHOLD && (
                        <a
                          href={buildNextRoundMailto({
                            candidate: { name: c.name, email: c.email },
                            roleTitle: role.title,
                            recruiterFirstName: user.name?.split(" ")[0] ?? null,
                          })}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] text-emerald-300 transition-colors hover:bg-emerald-500/20"
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
                        Transcript
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
                          <div className="truncate text-[14px] font-medium">
                            {c.name}
                          </div>
                          <div className="truncate text-[11px] text-white/45">
                            {c.email}
                          </div>
                        </div>
                      </Link>
                      {c.status === "completed" && c.score !== null ? (
                        <PHFitBadge score={c.score} />
                      ) : c.status === "in_progress" ? (
                        <span className="font-mono text-[11px] text-purple-300">
                          ongoing
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-white/30">
                          —
                        </span>
                      )}
                      <button
                        onClick={() => deleteCandidate(c)}
                        disabled={deletingId === c.id}
                        className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                        aria-label="Delete candidate"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    {c.verdict && (
                      <p className="mt-2 text-[12px] leading-relaxed text-white/55 line-clamp-2">
                        {c.verdict}
                      </p>
                    )}
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
            select: { status: true, endReason: true },
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
        slug: role.slug,
        title: role.title,
        jdText: role.jdText,
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
          status,
          endReason: conv?.endReason ?? null,
        };
      }),
    },
  };
};

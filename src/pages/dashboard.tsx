import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkInterviewQuota } from "@/lib/limits";
import {
  PHTopBar,
  PHButton,
  PHPill,
  PHFitBadge,
  ArrowRight,
  ChevronRight,
  Copy,
  Check,
} from "@/components/ph";

type RoleSummary = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  candidateCount: number;
  completedCount: number;
  inProgressCount: number;
  bestScore: number | null;
};

type RoleFilter = "all" | "active";

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  baseUrl: string;
  initialRoles: RoleSummary[];
  plan: "free" | "pro";
  monthlyInterviews: number;
  monthlyLimit: number | null;
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
}

function PlanBadge({
  plan,
  used,
  limit,
}: {
  plan: "free" | "pro";
  used: number;
  limit: number | null;
}) {
  const [opening, setOpening] = useState(false);
  if (plan === "pro") {
    return (
      <button
        type="button"
        onClick={async () => {
          if (opening) return;
          setOpening(true);
          try {
            const res = await fetch("/api/billing/portal", { method: "POST" });
            const data = await res.json();
            if (res.ok && data.url) {
              window.location.href = data.url;
            } else {
              setOpening(false);
            }
          } catch {
            setOpening(false);
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1 text-[11px] font-medium text-purple-300 ring-1 ring-inset ring-purple-500/30 transition-colors hover:bg-purple-500/20 disabled:opacity-60"
        disabled={opening}
      >
        <span className="ph-grad-text font-mono">Pro</span>
        <span className="text-white/55">
          {opening ? "Opening…" : "Manage billing"}
        </span>
      </button>
    );
  }
  const safeLimit = typeof limit === "number" ? limit : 10;
  const atLimit = used >= safeLimit;
  return (
    <Link
      href="/pricing"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
        atLimit
          ? "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
          : "border-white/15 bg-white/[0.02] text-white/75 hover:bg-white/5"
      }`}
    >
      <span className="font-mono">Free</span>
      <span className="text-white/45">
        {used} of {safeLimit} this month
      </span>
      <span className="text-purple-300">Upgrade →</span>
    </Link>
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

export default function Dashboard({
  user,
  baseUrl,
  initialRoles,
  plan,
  monthlyInterviews,
  monthlyLimit,
}: Props) {
  const [roles, setRoles] = useState<RoleSummary[]>(initialRoles);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<RoleSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = user.name?.split(" ")[0];
  const interviewLink = (slug: string) => `${baseUrl}/i/${slug}`;

  const inProgressTotal = roles.reduce(
    (acc, r) => acc + r.inProgressCount,
    0,
  );
  const doneCount = roles.reduce((acc, r) => acc + r.completedCount, 0);

  const visibleRoles =
    roleFilter === "active"
      ? roles.filter((r) => r.inProgressCount > 0)
      : roles;

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(interviewLink(slug));
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 1500);
  }

  // Opens the styled confirm modal (no native confirm/alert).
  function deleteRole(role: RoleSummary) {
    setDeleteError(null);
    setPendingDelete(role);
  }

  async function confirmDelete() {
    const role = pendingDelete;
    if (!role) return;
    setDeletingId(role.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Could not delete the role.");
        return;
      }
      setRoles((rs) => rs.filter((r) => r.id !== role.id));
      setPendingDelete(null);
    } catch {
      setDeleteError("Network error. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Dashboard · PurpleHire</title>
      </Head>

      {/* Delete confirmation modal — replaces the native confirm()/alert() */}
      {pendingDelete && (
        <div
          className="animate-fm-fade-up fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => deletingId === null && setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b12] p-6 shadow-card-lift sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30">
                <TrashIcon />
              </div>
              <div className="min-w-0">
                <h3 className="text-[17px] font-medium tracking-tight">
                  Delete &ldquo;{pendingDelete.title}&rdquo;?
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/60">
                  {pendingDelete.candidateCount > 0
                    ? `This permanently removes ${pendingDelete.candidateCount} candidate${pendingDelete.candidateCount === 1 ? "" : "s"} and their transcripts. This can't be undone.`
                    : "This can't be undone."}
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <PHButton
                variant="ghost"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
              >
                Cancel
              </PHButton>
              <PHButton
                variant="danger"
                onClick={confirmDelete}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? "Deleting…" : "Delete"}
              </PHButton>
            </div>
          </div>
        </div>
      )}
      <main className="ph-radial-purple relative min-h-screen text-white">
        <PHTopBar
          user={{
            email: user.email,
            image: user.image,
            letter: firstName?.[0]?.toUpperCase() ?? "A",
          }}
          onSignOut={() => signOut({ callbackUrl: "/signin" })}
        />

        <section className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div>
              <div className="font-mono text-[11px] tracking-[0.16em] text-white/40">
                DASHBOARD
              </div>
              <h1 className="mt-1.5 text-[26px] font-medium tracking-tight sm:mt-2 sm:text-[34px]">
                {greeting}
                {firstName ? `, ${firstName}` : ""}.
              </h1>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <PlanBadge
                plan={plan}
                used={monthlyInterviews}
                limit={monthlyLimit}
              />
              <div className="text-[12px] text-white/45 sm:text-[13px]">
                {roles.length === 0
                  ? "0 interviews in progress"
                  : `${roles.length} role${roles.length === 1 ? "" : "s"} · ${doneCount} completed · ${inProgressTotal} in progress`}
              </div>
            </div>
          </div>


          {/* YOUR INTERVIEWS */}
          <section className="mt-8 sm:mt-10">
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
              <h2 className="text-[16px] font-medium tracking-tight sm:text-[18px]">
                Your interviews
              </h2>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] px-1 py-1 sm:flex">
                  <PHPill
                    active={roleFilter === "all"}
                    onClick={() => setRoleFilter("all")}
                  >
                    All
                  </PHPill>
                  <PHPill
                    active={roleFilter === "active"}
                    onClick={() => setRoleFilter("active")}
                  >
                    Active
                  </PHPill>
                </div>
                <Link href="/dashboard/new">
                  <PHButton iconRight={<ArrowRight />}>
                    Create interview
                  </PHButton>
                </Link>
              </div>
            </div>

            {roles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.01] p-10 text-center sm:p-12">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center sm:h-20 sm:w-20">
                  <svg viewBox="0 0 80 80" className="h-full w-full" fill="none">
                    <rect
                      x="10"
                      y="14"
                      width="60"
                      height="52"
                      rx="10"
                      stroke="url(#empty-grad)"
                      strokeWidth="1.5"
                      strokeDasharray="3 4"
                    />
                    <path
                      d="M22 32h28M22 40h36M22 48h22"
                      stroke="url(#empty-grad)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient
                        id="empty-grad"
                        x1="0"
                        x2="80"
                        y1="0"
                        y2="80"
                      >
                        <stop stopColor="#a855f7" />
                        <stop offset="1" stopColor="#7e22ce" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="text-[17px] font-medium text-white/85 sm:text-[18px]">
                  No interviews yet
                </div>
                <p className="mt-1.5 text-[14px] text-white/50">
                  Create your first interview and we&apos;ll do the rest.
                </p>
                <div className="mt-5 flex justify-center">
                  <Link href="/dashboard/new">
                    <PHButton iconRight={<ArrowRight />}>
                      Create interview
                    </PHButton>
                  </Link>
                </div>
              </div>
            ) : visibleRoles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.01] p-10 text-center text-[14px] text-white/50 sm:p-12">
                No roles with interviews in progress.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-3xl border border-white/10 lg:block">
                  <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[11px] uppercase tracking-[0.14em] text-white/40">
                    <div className="col-span-3">Role</div>
                    <div className="col-span-1 text-right">Candidates</div>
                    <div className="col-span-1 text-right">Completed</div>
                    <div className="col-span-2 text-right">In progress</div>
                    <div className="col-span-1">Top score</div>
                    <div className="col-span-1">Created</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>
                  {visibleRoles.map((r, i) => {
                    const liveN = r.inProgressCount;
                    return (
                      <div
                        key={r.id}
                        className="group grid grid-cols-12 items-center gap-4 border-b border-white/5 px-6 py-4 transition-all duration-200 last:border-b-0 hover:-translate-y-0.5 hover:border-purple-500/25 hover:bg-purple-500/[0.04] hover:shadow-[0_10px_30px_-14px_rgba(147,51,234,0.5)]"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] font-mono text-[11px] text-white/55 ring-1 ring-inset ring-white/10">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <Link
                            href={`/dashboard/${r.slug}`}
                            className="truncate text-[14.5px] font-medium text-white transition-colors hover:text-purple-300"
                          >
                            {r.title}
                          </Link>
                        </div>
                        <div className="col-span-1 text-right font-mono text-[13px] text-white/75">
                          {r.candidateCount}
                        </div>
                        <div className="col-span-1 text-right font-mono text-[13px] text-white/75">
                          {r.completedCount}
                        </div>
                        <div className="col-span-2 text-right">
                          {liveN > 0 ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-purple-300">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inset-0 animate-fm-pulse-dot rounded-full bg-purple-500" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
                              </span>
                              {liveN}
                            </span>
                          ) : (
                            <span className="font-mono text-[12px] text-white/30">
                              —
                            </span>
                          )}
                        </div>
                        <div className="col-span-1">
                          {r.bestScore !== null ? (
                            <PHFitBadge score={r.bestScore} />
                          ) : (
                            <span className="font-mono text-[12px] text-white/30">
                              —
                            </span>
                          )}
                        </div>
                        <div className="col-span-1 text-[13px] text-white/50">
                          {formatShortDate(r.createdAt)}
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => copyLink(r.slug)}
                            aria-label="Copy interview link"
                            title="Copy interview link"
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-all duration-150 hover:scale-105 active:scale-90 ${
                              copiedSlug === r.slug
                                ? "text-emerald-300"
                                : "text-white/55 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {copiedSlug === r.slug ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy link
                              </>
                            )}
                          </button>
                          <Link
                            href={`/dashboard/${r.slug}`}
                            className="group inline-flex items-center gap-1 text-[13px] text-white/55 transition-all duration-150 hover:gap-1.5 hover:text-white"
                          >
                            View
                            <ChevronRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                          </Link>
                          <button
                            onClick={() => deleteRole(r)}
                            disabled={deletingId === r.id}
                            title="Delete interview"
                            className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition-all duration-150 hover:scale-110 hover:bg-red-500/15 hover:text-red-300 active:scale-90 disabled:opacity-40"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile cards */}
                <ul className="flex flex-col gap-2 lg:hidden">
                  {visibleRoles.map((r) => {
                    const liveN = r.inProgressCount;
                    return (
                      <li
                        key={r.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/dashboard/${r.slug}`}
                            className="flex min-w-0 flex-1 items-start gap-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-medium text-white">
                                {r.title}
                              </div>
                              <div className="mt-0.5 text-[11px] text-white/45">
                                {formatShortDate(r.createdAt)}
                              </div>
                            </div>
                          </Link>
                          <div className="flex items-center gap-2">
                            {r.bestScore !== null && (
                              <PHFitBadge score={r.bestScore} />
                            )}
                            <button
                              onClick={() => deleteRole(r)}
                              disabled={deletingId === r.id}
                              className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                              aria-label="Delete interview"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                          <span className="font-mono text-white/65">
                            {r.candidateCount} candidate
                            {r.candidateCount === 1 ? "" : "s"}
                          </span>
                          <span className="font-mono text-white/65">
                            {r.completedCount} completed
                          </span>
                          {liveN > 0 && (
                            <span className="inline-flex items-center gap-1.5 font-mono text-purple-300">
                              <span className="h-1.5 w-1.5 animate-fm-pulse-dot rounded-full bg-purple-500" />
                              {liveN} in progress
                            </span>
                          )}
                          <button
                            onClick={() => copyLink(r.slug)}
                            aria-label="Copy interview link"
                            className={`ml-auto inline-flex items-center gap-1 text-[11px] ${
                              copiedSlug === r.slug
                                ? "text-emerald-300"
                                : "text-white/55"
                            }`}
                          >
                            {copiedSlug === r.slug ? (
                              <>
                                <Check className="h-3 w-3" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Copy link
                              </>
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
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

  const roles = await prisma.role.findMany({
    where: { recruiterId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      candidates: {
        select: {
          score: true,
          conversations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  });

  const gate = await checkInterviewQuota({ recruiterId: userId });

  const host = ctx.req.headers.host ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  return {
    props: {
      user: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
      baseUrl: `${protocol}://${host}`,
      initialRoles: roles.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        createdAt: r.createdAt.toISOString(),
        candidateCount: r.candidates.length,
        completedCount: r.candidates.filter(
          (c) => c.conversations[0]?.status === "completed",
        ).length,
        inProgressCount: r.candidates.filter(
          (c) => c.conversations[0]?.status === "in_progress",
        ).length,
        bestScore: r.candidates.reduce<number | null>((best, c) => {
          if (c.score === null) return best;
          return best === null || c.score > best ? c.score : best;
        }, null),
      })),
      plan: gate.plan,
      monthlyInterviews: gate.monthlyInterviews,
      monthlyLimit: gate.monthlyLimit,
    },
  };
};

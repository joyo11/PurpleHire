import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PHTopBar,
  PHButton,
  PHInput,
  PHTextarea,
  PHPill,
  ArrowRight,
  ChevronRight,
  Sparkle,
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
};

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  baseUrl: string;
  initialRoles: RoleSummary[];
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
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

export default function Dashboard({ user, baseUrl, initialRoles }: Props) {
  const [roles, setRoles] = useState<RoleSummary[]>(initialRoles);
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = user.name?.split(" ")[0];
  const interviewLink = (slug: string) => `${baseUrl}/i/${slug}`;

  const liveCount = roles.reduce(
    (acc, r) => acc + (r.candidateCount - r.completedCount),
    0,
  );
  const doneCount = roles.reduce((acc, r) => acc + r.completedCount, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, jdText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setRoles([
        { ...data.role, candidateCount: 0, completedCount: 0 },
        ...roles,
      ]);
      setTitle("");
      setJdText("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(interviewLink(slug));
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 1500);
  }

  async function deleteRole(role: RoleSummary) {
    const summary =
      role.candidateCount > 0
        ? `Delete "${role.title}"? This permanently removes ${role.candidateCount} candidate${role.candidateCount === 1 ? "" : "s"} and their transcripts.`
        : `Delete "${role.title}"?`;
    if (!confirm(summary)) return;
    setDeletingId(role.id);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete the role.");
        return;
      }
      setRoles((rs) => rs.filter((r) => r.id !== role.id));
    } catch {
      alert("Network error. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Dashboard · PurpleHire</title>
      </Head>
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
            <div className="text-[12px] text-white/45 sm:text-[13px]">
              {roles.length === 0
                ? "0 interviews ongoing"
                : `${roles.length} role${roles.length === 1 ? "" : "s"} · ${doneCount} completed · ${liveCount} ongoing`}
            </div>
          </div>


          {/* CREATE INTERVIEW */}
          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.005] p-5 sm:p-7"
          >
            <div className="mb-5 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-purple-500/15 p-1.5 text-purple-300">
                <Sparkle className="h-full w-full" />
              </div>
              <h2 className="text-[16px] font-medium tracking-tight sm:text-[18px]">
                Create an interview
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <PHInput
                  label="Role title"
                  placeholder="e.g. Senior React Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <p className="mt-4 text-[12px] leading-relaxed text-white/45">
                  We&apos;ll parse the JD into must-haves, nice-to-haves, and a
                  calibrated interview plan automatically.
                </p>
              </div>

              <div className="lg:col-span-8">
                <PHTextarea
                  label="Job description"
                  placeholder="Paste the full JD. Markdown is fine. We'll figure out the rest."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={8}
                  count={jdText.length}
                  required
                  state={error ? "error" : "default"}
                />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-white/40">
                    We never share your JD. Used only to brief your interview.
                  </p>
                  {submitting ? (
                    <button
                      disabled
                      className="ph-grad-btn-bg relative flex h-11 items-center gap-2 overflow-hidden rounded-full px-5 text-[14.5px] font-medium text-white shadow-glow-purple"
                    >
                      <span className="ph-shimmer-bg pointer-events-none absolute inset-0 rounded-full opacity-60 animate-fm-shimmer" />
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeOpacity=".25"
                          strokeWidth="2.5"
                        />
                        <path
                          d="M21 12a9 9 0 0 0-9-9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      Analyzing JD…
                    </button>
                  ) : (
                    <PHButton
                      type="submit"
                      iconRight={<ArrowRight />}
                    >
                      Create interview
                    </PHButton>
                  )}
                </div>
                {error && (
                  <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </form>

          {/* YOUR INTERVIEWS */}
          <section className="mt-10 sm:mt-12">
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <h2 className="text-[16px] font-medium tracking-tight sm:text-[18px]">
                Your interviews
              </h2>
              <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] px-1 py-1 sm:flex">
                <PHPill active>All</PHPill>
                <PHPill>Active</PHPill>
                <PHPill>Archived</PHPill>
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
                  Paste your first JD above and we&apos;ll do the rest.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-3xl border border-white/10 lg:block">
                  <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[11px] uppercase tracking-[0.14em] text-white/40">
                    <div className="col-span-4">Role</div>
                    <div className="col-span-2">Created</div>
                    <div className="col-span-1 text-right">Done</div>
                    <div className="col-span-1 text-right">Ongoing</div>
                    <div className="col-span-3">Interview URL</div>
                    <div className="col-span-1 text-right">·</div>
                  </div>
                  {roles.map((r, i) => {
                    const liveN = r.candidateCount - r.completedCount;
                    return (
                      <div
                        key={r.id}
                        className="group grid grid-cols-12 items-center gap-4 border-b border-white/5 px-6 py-4 transition-all last:border-b-0 hover:-translate-y-px hover:border-white/15 hover:bg-white/[0.025]"
                      >
                        <div className="col-span-4 flex items-center gap-3">
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
                        <div className="col-span-2 text-[13px] text-white/50">
                          {formatShortDate(r.createdAt)}
                        </div>
                        <div className="col-span-1 text-right font-mono text-[13px] text-white/75">
                          {r.completedCount}
                        </div>
                        <div className="col-span-1 text-right">
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
                        <div className="col-span-3">
                          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5">
                            <span className="truncate font-mono text-[11.5px] text-white/55">
                              /i/{r.slug}
                            </span>
                            <button
                              onClick={() => copyLink(r.slug)}
                              className={`ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                                copiedSlug === r.slug
                                  ? "text-emerald-300"
                                  : "text-white/55 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {copiedSlug === r.slug ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <button
                            onClick={() => deleteRole(r)}
                            disabled={deletingId === r.id}
                            title="Delete interview"
                            className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                          >
                            <TrashIcon />
                          </button>
                          <Link
                            href={`/dashboard/${r.slug}`}
                            className="inline-flex items-center gap-1 text-[13px] text-white/55 transition-colors hover:text-white"
                          >
                            View
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile cards */}
                <ul className="flex flex-col gap-2 lg:hidden">
                  {roles.map((r) => {
                    const liveN = r.candidateCount - r.completedCount;
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
                          <button
                            onClick={() => deleteRole(r)}
                            disabled={deletingId === r.id}
                            className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                            aria-label="Delete interview"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-[12px]">
                          <span className="font-mono text-white/65">
                            {r.completedCount} done
                          </span>
                          {liveN > 0 && (
                            <span className="inline-flex items-center gap-1.5 font-mono text-purple-300">
                              <span className="h-1.5 w-1.5 animate-fm-pulse-dot rounded-full bg-purple-500" />
                              {liveN} ongoing
                            </span>
                          )}
                          <button
                            onClick={() => copyLink(r.slug)}
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
          conversations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  });

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
      })),
    },
  };
};

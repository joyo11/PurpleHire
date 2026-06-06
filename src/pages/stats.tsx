import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PHTopBar, ChevronLeft } from "@/components/ph";
import { signOut } from "next-auth/react";

type Trend = { label: string; value: number };
type RecruiterRow = {
  name: string;
  email: string;
  roles: number;
  candidates: number;
  interviews: number;
  completed: number;
  avgScore: number | null;
};
type DistRow = { label: string; value: number };
type Window = { users: number; candidates: number; interviews: number; completed: number };

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  stats: {
    totals: {
      recruiters: number;
      candidates: number;
      roles: number;
      interviews: number;
      completed: number;
      ongoing: number;
      avgScore: number | null;
      scored: number;
      completionRate: number; // 0..100
    };
    windows: { d1: Window; d7: Window; d30: Window };
    trendInterviews: Trend[];
    trendCandidates: Trend[];
    scoreDist: DistRow[];
    recruiters: RecruiterRow[];
  };
  generatedAt: string;
};

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "emerald" | "purple";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "purple"
        ? "text-purple-300"
        : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div
        className={`font-mono text-[28px] font-medium tabular-nums sm:text-[34px] ${color}`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-white/35">{sub}</div> : null}
    </div>
  );
}

function MiniBars({ data, accent }: { data: Trend[]; accent: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 72 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            title={`${d.label}: ${d.value}`}
            className={`w-full rounded-sm ${accent}`}
            style={{ height: `${Math.max(2, (d.value / max) * 64)}px` }}
          />
          <div className="text-[8px] text-white/25">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function DistBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-right font-mono text-[12px] text-white/50">
        {label}
      </div>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full rounded-full bg-purple-400/70"
          style={{ width: `${(value / Math.max(1, max)) * 100}%` }}
        />
      </div>
      <div className="w-8 text-right font-mono text-[12px] tabular-nums text-white/70">
        {value}
      </div>
    </div>
  );
}

function WindowCard({ title, w }: { title: string; w: Window }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-white/45">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[13px]">
        <Row label="New users" value={w.users} />
        <Row label="New candidates" value={w.candidates} />
        <Row label="Interviews started" value={w.interviews} />
        <Row label="Completed" value={w.completed} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </span>
      <span className="tabular-nums text-white">{value.toLocaleString()}</span>
    </div>
  );
}

export default function StatsPage({ user, stats, generatedAt }: Props) {
  const t = stats.totals;
  const maxDist = Math.max(1, ...stats.scoreDist.map((d) => d.value));
  return (
    <>
      <Head>
        <title>Analytics · PurpleHire</title>
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

        <section className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <header className="mt-5">
            <div className="font-mono text-[11px] tracking-[0.16em] text-white/40">
              ADMIN · ANALYTICS
            </div>
            <h1 className="mt-2 text-[26px] font-medium tracking-tight sm:text-[34px]">
              PurpleHire, whole-app analytics
            </h1>
            <div className="mt-2 text-[12px] text-white/45">
              Generated {new Date(generatedAt).toLocaleString()} · live from the
              database
            </div>
          </header>

          {/* Headline totals */}
          <section className="mt-8">
            <h2 className="mb-3 text-[14px] font-medium text-white/60">
              All time
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat
                label="Recruiters (signed-up users)"
                value={t.recruiters}
                accent="purple"
              />
              <Stat label="Candidates interviewed" value={t.candidates} />
              <Stat label="Total interviews" value={t.interviews} />
              <Stat label="Roles posted" value={t.roles} />
              <Stat
                label="Interviews complete"
                value={t.completed}
                accent="emerald"
              />
              <Stat label="Ongoing" value={t.ongoing} />
              <Stat
                label="Completion rate"
                value={`${t.completionRate.toFixed(0)}%`}
                sub={`${t.completed} of ${t.interviews}`}
              />
              <Stat
                label="Avg candidate score"
                value={t.avgScore == null ? "—" : t.avgScore.toFixed(1)}
                sub={`${t.scored} scored`}
                accent="emerald"
              />
            </div>
          </section>

          {/* Trends */}
          <section className="mt-10 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-white/45">
                Interviews started · last 14 days
              </div>
              <MiniBars data={stats.trendInterviews} accent="bg-emerald-400/70" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-white/45">
                New candidates · last 14 days
              </div>
              <MiniBars data={stats.trendCandidates} accent="bg-purple-400/70" />
            </div>
          </section>

          {/* Time windows */}
          <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <WindowCard title="Last 24 hours" w={stats.windows.d1} />
            <WindowCard title="Last 7 days" w={stats.windows.d7} />
            <WindowCard title="Last 30 days" w={stats.windows.d30} />
          </section>

          {/* Score distribution */}
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-4 text-[12px] font-medium uppercase tracking-[0.12em] text-white/45">
              Candidate score distribution
            </div>
            <div className="space-y-2.5">
              {stats.scoreDist.map((d) => (
                <DistBar key={d.label} label={d.label} value={d.value} max={maxDist} />
              ))}
            </div>
          </section>

          {/* Per-recruiter */}
          <section className="mt-10">
            <h2 className="mb-3 text-[14px] font-medium text-white/60">
              By recruiter
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-4 py-3 font-medium">Recruiter</th>
                    <th className="px-4 py-3 text-right font-medium">Roles</th>
                    <th className="px-4 py-3 text-right font-medium">Candidates</th>
                    <th className="px-4 py-3 text-right font-medium">Interviews</th>
                    <th className="px-4 py-3 text-right font-medium">Done</th>
                    <th className="px-4 py-3 text-right font-medium">Avg score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {stats.recruiters.map((r, i) => (
                    <tr key={i} className="bg-white/[0.01]">
                      <td className="px-4 py-3">
                        <div className="text-white">{r.name || "—"}</div>
                        <div className="text-[11px] text-white/40">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white/80">
                        {r.roles}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white/80">
                        {r.candidates}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white/80">
                        {r.interviews}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-300">
                        {r.completed}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white/80">
                        {r.avgScore == null ? "—" : r.avgScore.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  {stats.recruiters.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-white/40">
                        No recruiters yet
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-[13px] leading-relaxed text-white/65">
            <p className="mb-2 font-medium text-white">Page-view analytics</p>
            <p>
              Visitors, page views, referrers, and country data are anonymous
              web traffic, tracked by Vercel Analytics (Vercel project →{" "}
              <span className="font-mono text-purple-300">Analytics</span> tab).
              Everything above is real product usage from the database.
            </p>
          </section>
        </section>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const userEmail = session?.user?.email?.toLowerCase();

  if (!session?.user) {
    return { redirect: { destination: "/signin", permanent: false } };
  }
  if (!adminEmail || userEmail !== adminEmail) {
    return { notFound: true };
  }

  const [users, roles, candidates, conversations] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.role.findMany({
      select: { id: true, recruiterId: true, createdAt: true },
    }),
    prisma.candidate.findMany({
      select: { id: true, roleId: true, score: true, createdAt: true },
    }),
    prisma.conversation.findMany({
      select: {
        id: true,
        candidateId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const completed = conversations.filter((c) => c.status === "completed").length;
  const ongoing = conversations.filter((c) => c.status === "in_progress").length;
  const interviews = conversations.length;

  const scoredCands = candidates.filter((c) => c.score != null);
  const avgScore = scoredCands.length
    ? scoredCands.reduce((s, c) => s + (c.score as number), 0) / scoredCands.length
    : null;

  // Score distribution
  const inBucket = (lo: number, hi: number) =>
    scoredCands.filter((c) => (c.score as number) >= lo && (c.score as number) < hi)
      .length;
  const scoreDist: DistRow[] = [
    { label: "8.0–10", value: inBucket(8, 10.0001) },
    { label: "6.0–8.0", value: inBucket(6, 8) },
    { label: "4.0–6.0", value: inBucket(4, 6) },
    { label: "< 4.0", value: inBucket(-1, 4) },
  ];

  // Time windows
  const ms = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const mkWindow = (days: number): Window => {
    const since = new Date(now - days * ms);
    return {
      users: users.filter((u) => u.createdAt >= since).length,
      candidates: candidates.filter((c) => c.createdAt >= since).length,
      interviews: conversations.filter((c) => c.createdAt >= since).length,
      completed: conversations.filter(
        (c) => c.status === "completed" && c.updatedAt >= since,
      ).length,
    };
  };

  // 14-day trends
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const days: { key: string; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * ms);
    days.push({ key: dayKey(d), label: `${d.getMonth() + 1}/${d.getDate()}` });
  }
  const countByDay = (items: { createdAt: Date }[]): Trend[] =>
    days.map((day) => ({
      label: day.label,
      value: items.filter((it) => dayKey(it.createdAt) === day.key).length,
    }));

  // Per-recruiter rollup
  const recruiterRows: RecruiterRow[] = users
    .map((u) => {
      const userRoleIds = new Set(
        roles.filter((r) => r.recruiterId === u.id).map((r) => r.id),
      );
      const userCands = candidates.filter((c) => userRoleIds.has(c.roleId));
      const candIds = new Set(userCands.map((c) => c.id));
      const userConvs = conversations.filter(
        (cv) => cv.candidateId && candIds.has(cv.candidateId),
      );
      const userScored = userCands.filter((c) => c.score != null);
      return {
        name: u.name ?? "",
        email: u.email ?? "—",
        roles: userRoleIds.size,
        candidates: userCands.length,
        interviews: userConvs.length,
        completed: userConvs.filter((cv) => cv.status === "completed").length,
        avgScore: userScored.length
          ? userScored.reduce((s, c) => s + (c.score as number), 0) /
            userScored.length
          : null,
      };
    })
    .sort((a, b) => b.candidates - a.candidates);

  return {
    props: {
      user: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
      stats: {
        totals: {
          recruiters: users.length,
          candidates: candidates.length,
          roles: roles.length,
          interviews,
          completed,
          ongoing,
          avgScore,
          scored: scoredCands.length,
          completionRate: interviews ? (completed / interviews) * 100 : 0,
        },
        windows: { d1: mkWindow(1), d7: mkWindow(7), d30: mkWindow(30) },
        trendInterviews: countByDay(conversations),
        trendCandidates: countByDay(candidates),
        scoreDist,
        recruiters: recruiterRows,
      },
      generatedAt: new Date().toISOString(),
    },
  };
};

import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PHTopBar, ChevronLeft } from "@/components/ph";
import { signOut } from "next-auth/react";

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  stats: {
    recruiters: number;
    roles: number;
    candidates: number;
    completed: number;
    ongoing: number;
    last24h: {
      candidates: number;
      completed: number;
    };
  };
  generatedAt: string;
};

function Stat({
  label,
  value,
  emerald,
}: {
  label: string;
  value: number;
  emerald?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div
        className={`font-mono text-[28px] font-medium tabular-nums sm:text-[34px] ${
          emerald ? "text-emerald-300" : "text-white"
        }`}
      >
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </div>
    </div>
  );
}

export default function StatsPage({ user, stats, generatedAt }: Props) {
  return (
    <>
      <Head>
        <title>Stats · PurpleHire</title>
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
              ADMIN · STATS
            </div>
            <h1 className="mt-2 text-[26px] font-medium tracking-tight sm:text-[34px]">
              PurpleHire usage
            </h1>
            <div className="mt-2 text-[12px] text-white/45">
              Generated {new Date(generatedAt).toLocaleString()} · cached 60s
            </div>
          </header>

          <section className="mt-8">
            <h2 className="mb-3 text-[14px] font-medium text-white/60">
              All time
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Recruiters" value={stats.recruiters} />
              <Stat label="Roles posted" value={stats.roles} />
              <Stat label="Candidates" value={stats.candidates} />
              <Stat label="Interviews complete" value={stats.completed} emerald />
              <Stat label="Ongoing" value={stats.ongoing} />
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-[14px] font-medium text-white/60">
              Last 24 hours
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="New candidates" value={stats.last24h.candidates} />
              <Stat
                label="Interviews complete"
                value={stats.last24h.completed}
                emerald
              />
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-[13px] leading-relaxed text-white/65">
            <p className="mb-2 font-medium text-white">Page-view analytics</p>
            <p>
              Page views, unique visitors, top referrers, and country data
              are tracked by Vercel Analytics. Open the Vercel project →{" "}
              <span className="font-mono text-purple-300">Analytics</span> tab
              for that dashboard.
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

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recruiters, roles, candidates, completed, ongoing, c24, done24] =
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.candidate.count(),
      prisma.conversation.count({ where: { status: "completed" } }),
      prisma.conversation.count({ where: { status: "in_progress" } }),
      prisma.candidate.count({ where: { createdAt: { gte: since24h } } }),
      prisma.conversation.count({
        where: { status: "completed", updatedAt: { gte: since24h } },
      }),
    ]);

  return {
    props: {
      user: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
      stats: {
        recruiters,
        roles,
        candidates,
        completed,
        ongoing,
        last24h: { candidates: c24, completed: done24 },
      },
      generatedAt: new Date().toISOString(),
    },
  };
};

import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export default function Dashboard({ user, baseUrl, initialRoles }: Props) {
  const [roles, setRoles] = useState<RoleSummary[]>(initialRoles);
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const interviewLink = (slug: string) => `${baseUrl}/i/${slug}`;

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

  return (
    <>
      <Head>
        <title>Dashboard · PurpleHire</title>
      </Head>
      <main className="min-h-screen bg-black px-4 py-6 text-white sm:py-8">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 flex items-center justify-between gap-3 sm:mb-12">
            <h1 className="text-xl font-semibold sm:text-2xl">PurpleHire</h1>
            <div className="flex items-center gap-2 sm:gap-3">
              {user.image && (
                <img
                  src={user.image}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              )}
              <span className="hidden text-sm text-white/70 sm:inline">
                {user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          </header>

          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-1 text-lg font-medium">Create an interview</h2>
            <p className="mb-5 text-sm text-white/60">
              Paste a job description and we'll generate a shareable link your
              candidates can take an AI interview through.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-white/70">
                  Role title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Senior iOS Engineer"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">
                  Job description
                </label>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  required
                  rows={10}
                  placeholder="Paste the full JD here — responsibilities, requirements, nice-to-haves, etc."
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
                />
              </div>
              {error && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-white px-5 py-2.5 font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Analyzing JD…" : "Create interview"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-medium">Your interviews</h2>
            {roles.length === 0 ? (
              <p className="text-sm text-white/50">No interviews yet.</p>
            ) : (
              <ul className="space-y-3">
                {roles.map((role) => (
                  <li
                    key={role.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20"
                  >
                    <div className="mb-3 flex items-baseline justify-between">
                      <Link
                        href={`/dashboard/${role.slug}`}
                        className="font-medium hover:underline"
                      >
                        {role.title}
                      </Link>
                      <span className="text-xs text-white/40">
                        {new Date(role.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mb-3 flex items-center gap-4 text-xs text-white/60">
                      <span>
                        {role.completedCount} completed
                      </span>
                      <span className="text-white/30">·</span>
                      <span>
                        {role.candidateCount - role.completedCount} in progress
                      </span>
                      <Link
                        href={`/dashboard/${role.slug}`}
                        className="ml-auto text-white/70 hover:text-white"
                      >
                        View candidates →
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md bg-black/40 px-3 py-2 text-xs text-white/70">
                        {interviewLink(role.slug)}
                      </code>
                      <button
                        onClick={() => copyLink(role.slug)}
                        className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/80 transition hover:bg-white/5"
                      >
                        {copiedSlug === role.slug ? "Copied!" : "Copy link"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
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

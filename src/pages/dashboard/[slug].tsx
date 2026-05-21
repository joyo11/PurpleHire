import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  role: {
    slug: string;
    title: string;
    jdText: string;
    createdAt: string;
  };
  baseUrl: string;
  candidates: CandidateRow[];
};

function scoreColor(score: number) {
  if (score >= 8) return "bg-green-500/15 text-green-300 border-green-500/30";
  if (score >= 5) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  return "bg-red-500/15 text-red-300 border-red-500/30";
}

function statusLabel(c: CandidateRow): string {
  if (c.status === "completed") return c.endReason || "completed";
  if (c.status === "in_progress") return "in progress";
  return "not started";
}

export default function RoleDetail({ role, baseUrl, candidates }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${baseUrl}/i/${role.slug}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const completed = candidates.filter((c) => c.status === "completed");
  const others = candidates.filter((c) => c.status !== "completed");

  return (
    <>
      <Head>
        <title>{role.title} · PurpleHire</title>
      </Head>
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard"
            className="mb-6 inline-block text-sm text-white/50 hover:text-white"
          >
            ← All interviews
          </Link>

          <header className="mb-8">
            <h1 className="mb-1 text-2xl font-semibold">{role.title}</h1>
            <p className="text-sm text-white/50">
              Created {new Date(role.createdAt).toLocaleDateString()} ·{" "}
              {candidates.length} candidate
              {candidates.length === 1 ? "" : "s"}
            </p>
          </header>

          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="mb-2 text-sm font-medium">Candidate link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-black/40 px-3 py-2 text-xs text-white/70">
                {link}
              </code>
              <button
                onClick={copyLink}
                className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/80 transition hover:bg-white/5"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-lg font-medium">Candidates</h2>
            {candidates.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
                No one's taken this interview yet. Share the link above.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...completed, ...others].map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="truncate font-medium">{c.name}</p>
                          {c.score !== null ? (
                            <span
                              className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${scoreColor(c.score)}`}
                            >
                              {c.score}/10
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">
                              {statusLabel(c)}
                            </span>
                          )}
                        </div>
                        <p className="mb-1 text-xs text-white/40">{c.email}</p>
                        {c.verdict && (
                          <p className="text-sm text-white/70">{c.verdict}</p>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/${role.slug}/${c.id}`}
                        className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/5"
                      >
                        Transcript
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Job description</h2>
            <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
              {role.jdText}
            </pre>
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
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

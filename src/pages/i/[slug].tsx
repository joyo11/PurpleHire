import Head from "next/head";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import CandidateChat from "@/components/CandidateChat";

type Props = {
  slug: string;
  roleTitle: string;
};

type StartedState = {
  conversationId: string;
  candidateName: string;
  roleTitle: string;
};

export default function CandidatePage({ slug, roleTitle }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState<StartedState | null>(null);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/interviews/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start the interview.");
        return;
      }
      setStarted({
        conversationId: data.conversationId,
        candidateName: name.trim(),
        roleTitle: data.roleTitle,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (started) {
    return (
      <>
        <Head>
          <title>{started.roleTitle} interview · PurpleHire</title>
        </Head>
        <CandidateChat
          conversationId={started.conversationId}
          candidateName={started.candidateName}
          roleTitle={started.roleTitle}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{roleTitle} interview · PurpleHire</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="mb-1 text-xs uppercase tracking-wide text-white/40">
            You've been invited to an AI interview
          </p>
          <h1 className="mb-2 text-2xl font-semibold text-white">
            {roleTitle}
          </h1>
          <p className="mb-6 text-sm text-white/60">
            Ava, the AI recruiter, will ask you a few questions about your
            background and the role. Your answers will be shared with the
            hiring team. Takes ~10 minutes.
          </p>

          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-white/70">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your full name"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
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
              className="w-full rounded-lg bg-white px-5 py-2.5 font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Starting…" : "Start interview"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const slug = ctx.params?.slug;
  if (typeof slug !== "string") return { notFound: true };

  const role = await prisma.role.findUnique({
    where: { slug },
    select: { title: true },
  });

  if (!role) return { notFound: true };

  return { props: { slug, roleTitle: role.title } };
};

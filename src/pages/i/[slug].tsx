import Head from "next/head";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import CandidateChat from "@/components/CandidateChat";
import {
  PHEyebrow,
  PHInput,
  PHButton,
  ArrowRight,
} from "@/components/ph";

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
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-black px-5 text-white">
        <div
          className="pointer-events-none absolute inset-0 animate-fm-drift opacity-90"
          style={{
            background:
              "radial-gradient(50% 60% at 30% 30%, rgba(147,51,234,0.28), rgba(147,51,234,0) 60%), radial-gradient(60% 80% at 80% 70%, rgba(126,34,206,0.22), rgba(126,34,206,0) 60%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 ph-grid-bg opacity-40" />

        <form
          onSubmit={handleStart}
          className="relative w-full max-w-[520px] animate-fm-fade-up rounded-3xl border border-white/10 bg-black/60 p-6 shadow-card-lift backdrop-blur sm:p-8"
        >
          <PHEyebrow live>You&apos;ve been invited to an AI interview</PHEyebrow>
          <h1 className="mt-5 text-[28px] font-medium leading-[1.05] tracking-tight sm:text-[34px]">
            {roleTitle}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/65 sm:text-[14.5px]">
            PurpleHire is an AI recruiter. We&apos;ll chat for ~10 minutes about
            your experience — no trick questions, no take-home. Your responses
            go straight to the hiring team.
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <PHInput
              label="Your name"
              placeholder="e.g. Maya R."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
            <PHInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              helper="We'll send your interview summary here."
              state={error ? "error" : "default"}
            />
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {error}
            </p>
          )}

          <div className="mt-6">
            <PHButton
              type="submit"
              size="lg"
              iconRight={<ArrowRight />}
              className="w-full"
              state={submitting ? "loading" : "default"}
            >
              {submitting ? "Connecting to PurpleHire…" : "Start interview"}
            </PHButton>
          </div>

          <div className="mt-5 flex items-center justify-between text-[11px] text-white/40 sm:text-[12px]">
            <div className="flex items-center gap-1.5">
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="3" y="7" width="10" height="6" rx="1.5" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" />
              </svg>
              Encrypted in transit
            </div>
            <div className="font-mono">~10 min</div>
          </div>
        </form>
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

import Head from "next/head";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import CandidateChat from "@/components/CandidateChat";
import VoiceInterview from "@/components/VoiceInterview";
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

type InterviewMode = "chat" | "voice";

type StartedState = {
  conversationId: string;
  candidateName: string;
  roleTitle: string;
  mode: InterviewMode;
};

export default function CandidatePage({ slug, roleTitle }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<InterviewMode>("chat");
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
        body: JSON.stringify({ slug, name, email, mode }),
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
        mode: data.mode === "voice" ? "voice" : "chat",
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
        {started.mode === "voice" ? (
          <VoiceInterview
            conversationId={started.conversationId}
            candidateName={started.candidateName}
            roleTitle={started.roleTitle}
          />
        ) : (
          <CandidateChat
            conversationId={started.conversationId}
            candidateName={started.candidateName}
            roleTitle={started.roleTitle}
          />
        )}
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

          {/* Mode picker — chat (default) or voice. Voice uses the browser's
              built-in Web Speech API so it's free per interview; the recruiter
              sees a 🎤 badge in the inbox either way. */}
          <fieldset className="mt-5">
            <legend className="mb-2 text-[12px] font-medium uppercase tracking-wider text-white/55">
              How do you want to interview?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <ModeCard
                active={mode === "chat"}
                onClick={() => setMode("chat")}
                label="Chat"
                desc="Type your answers"
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" />
                  </svg>
                }
              />
              <ModeCard
                active={mode === "voice"}
                onClick={() => setMode("voice")}
                label="Voice"
                desc="Talk it out"
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
                  </svg>
                }
              />
            </div>
            {mode === "voice" && (
              <p className="mt-2 text-[11px] text-white/45">
                Needs Chrome, Edge, or Safari. You can also switch to chat anytime.
              </p>
            )}
          </fieldset>

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

function ModeCard({
  active,
  onClick,
  label,
  desc,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? "border-purple-400 bg-purple-500/15 shadow-[0_0_24px_rgba(168,85,247,0.18)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
      }`}
      aria-pressed={active}
    >
      <span className={active ? "text-purple-200" : "text-white/70"}>{icon}</span>
      <span className="flex flex-col">
        <span className="text-[13.5px] font-medium text-white">{label}</span>
        <span className="text-[11.5px] text-white/55">{desc}</span>
      </span>
    </button>
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

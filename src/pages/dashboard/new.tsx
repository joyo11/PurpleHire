import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import {
  PHTopBar,
  PHButton,
  PHInput,
  PHTextarea,
  ArrowRight,
  ChevronLeft,
  Sparkle,
  Check,
} from "@/components/ph";

type InterviewPlanDraft = {
  summary: string;
  must_haves: string[];
  nice_to_haves: string[];
  skills_to_probe: string[];
  red_flags: string[];
  competencies: string[];
  questions: string[];
  estimated_minutes: number;
};

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  baseUrl: string;
};

type StepKey = 1 | 2 | 3;

const STEPS: { key: StepKey; label: string }[] = [
  { key: 1, label: "Role" },
  { key: 2, label: "Interview plan" },
  { key: 3, label: "Launch" },
];

/* ---------- Step indicator ---------- */
function StepIndicator({ step }: { step: StepKey }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = s.key < step;
        const active = s.key === step;
        return (
          <li key={s.key} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "grid h-7 w-7 place-items-center rounded-full text-[12px] font-medium transition-colors",
                  active
                    ? "ph-grad-btn-bg text-white shadow-glow-purple-sm"
                    : done
                      ? "bg-purple-500/20 text-purple-200 ring-1 ring-inset ring-purple-500/40"
                      : "bg-white/[0.04] text-white/40 ring-1 ring-inset ring-white/10",
                ].join(" ")}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.key}
              </span>
              <span
                className={[
                  "hidden text-[13px] font-medium sm:block",
                  active
                    ? "text-white"
                    : done
                      ? "text-white/70"
                      : "text-white/40",
                ].join(" ")}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={[
                  "h-px w-6 sm:w-10",
                  done ? "bg-purple-500/50" : "bg-white/10",
                ].join(" ")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Editable list ---------- */
function EditableList({
  label,
  hint,
  items,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  }

  function edit(index: number, value: string) {
    onChange(items.map((it, i) => (i === index ? value : it)));
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium text-white/85">{label}</h3>
        <span className="font-mono text-[11px] text-white/35">
          {items.length}
        </span>
      </div>
      {hint && <p className="mb-3 text-[12px] text-white/45">{hint}</p>}

      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            {multiline ? (
              <textarea
                value={item}
                onChange={(e) => edit(i, e.target.value)}
                rows={2}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13.5px] leading-relaxed text-white/90 transition-colors placeholder:text-white/30 focus:border-purple-500/40 focus:outline-none"
              />
            ) : (
              <input
                value={item}
                onChange={(e) => edit(i, e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-[13.5px] text-white/90 transition-colors placeholder:text-white/30 focus:border-purple-500/40 focus:outline-none"
              />
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${label} item ${i + 1}`}
              className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/35 transition-colors hover:bg-red-500/15 hover:text-red-300"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M4 8h8" />
              </svg>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-[12.5px] text-white/35">
            Nothing here yet. Add an item below.
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-start gap-2">
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[13.5px] leading-relaxed text-white/90 placeholder:text-white/30 focus:border-purple-500/40 focus:outline-none"
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 text-[13.5px] text-white/90 placeholder:text-white/30 focus:border-purple-500/40 focus:outline-none"
          />
        )}
        <PHButton size="sm" variant="ghost" onClick={add} className="shrink-0">
          Add
        </PHButton>
      </div>
    </div>
  );
}

export default function NewRole({ user, baseUrl }: Props) {
  const router = useRouter();
  const firstName = user.name?.split(" ")[0];

  const [step, setStep] = useState<StepKey>(1);

  // Step 1
  const [title, setTitle] = useState("");
  const [jdText, setJdText] = useState("");

  // Step 2
  const [plan, setPlan] = useState<InterviewPlanDraft | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);

  // Step 3
  const [expiresAt, setExpiresAt] = useState("");
  const [durationMin, setDurationMin] = useState<number>(20);
  const [allowRetries, setAllowRetries] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchPlan(patch: Partial<InterviewPlanDraft>) {
    setPlan((p) => (p ? { ...p, ...patch } : p));
  }

  async function goToPlan() {
    setError(null);
    if (!title.trim() || !jdText.trim()) {
      setError("Add a role title and paste the job description to continue.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/roles/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, jdText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not build the interview plan.");
        return;
      }
      const draft = data.plan as InterviewPlanDraft;
      setPlan(draft);
      setConfidence(data.confidence ?? null);
      if (draft.estimated_minutes) setDurationMin(draft.estimated_minutes);
      setStep(2);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function create() {
    if (!plan) return;
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          jdText,
          interviewPlan: { ...plan, estimated_minutes: durationMin },
          expiresAt: expiresAt || null,
          durationMin,
          allowRetries,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create the role.");
        return;
      }
      router.push(`/dashboard/${data.role.slug}`);
    } catch {
      setError("Network error. Try again.");
      setCreating(false);
    }
  }

  return (
    <>
      <Head>
        <title>New role · PurpleHire</title>
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

        <section className="mx-auto max-w-[920px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          {/* Header + step indicator */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-mono text-[11px] tracking-[0.16em] text-white/40">
                NEW INTERVIEW
              </div>
              <h1 className="mt-1.5 text-[24px] font-medium tracking-tight sm:text-[30px]">
                Create a role
              </h1>
            </div>
            <StepIndicator step={step} />
          </div>

          {error && (
            <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {error}
            </p>
          )}

          {/* STEP 1: ROLE */}
          {step === 1 && (
            <div className="mt-7 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.005] p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-purple-500/15 p-1.5 text-purple-300">
                  <Sparkle className="h-full w-full" />
                </div>
                <h2 className="text-[16px] font-medium tracking-tight sm:text-[18px]">
                  The role
                </h2>
              </div>

              <PHInput
                label="Role title"
                placeholder="e.g. Senior React Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="mt-5">
                <PHTextarea
                  label="Job description"
                  placeholder="Paste the full JD. Markdown is fine. We'll build the interview plan from it."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={10}
                  count={jdText.length}
                  countMax={20000}
                />
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-[12px] text-white/40">
                  We never share your JD. Used only to brief your interview.
                </p>
                <PHButton
                  onClick={goToPlan}
                  disabled={analyzing}
                  state={analyzing ? "loading" : "default"}
                  iconRight={analyzing ? undefined : <ArrowRight />}
                >
                  {analyzing ? "Building plan…" : "Continue"}
                </PHButton>
              </div>
            </div>
          )}

          {/* STEP 2: INTERVIEW PLAN */}
          {step === 2 && plan && (
            <div className="mt-7">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.005] p-5 sm:p-7">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-purple-500/15 p-1.5 text-purple-300">
                      <Sparkle className="h-full w-full" />
                    </div>
                    <h2 className="text-[16px] font-medium tracking-tight sm:text-[18px]">
                      Interview plan
                    </h2>
                  </div>
                  {confidence && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[11px] font-medium text-white/60">
                      <span className="font-mono uppercase tracking-wider text-purple-300">
                        {confidence}
                      </span>
                      confidence
                    </span>
                  )}
                </div>

                <p className="mb-5 text-[13.5px] leading-relaxed text-white/55">
                  Review and edit before you launch. Add, remove, or rewrite
                  anything: this is exactly what the AI interviewer will probe
                  for.
                </p>

                {plan.summary && (
                  <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-1 text-[12px] font-medium uppercase tracking-wider text-white/40">
                      Summary
                    </div>
                    <textarea
                      value={plan.summary}
                      onChange={(e) => patchPlan({ summary: e.target.value })}
                      rows={2}
                      className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-white/90 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <EditableList
                    label="Must-haves"
                    hint="Dealbreakers if the candidate clearly lacks them."
                    items={plan.must_haves}
                    onChange={(must_haves) => patchPlan({ must_haves })}
                    placeholder="Add a must-have"
                  />
                  <EditableList
                    label="Nice-to-haves"
                    hint="Bonus signals that strengthen a candidate."
                    items={plan.nice_to_haves}
                    onChange={(nice_to_haves) => patchPlan({ nice_to_haves })}
                    placeholder="Add a nice-to-have"
                  />
                  <EditableList
                    label="Competencies to probe"
                    hint="Topics the interview will dig into."
                    items={plan.competencies}
                    onChange={(competencies) =>
                      patchPlan({ competencies, skills_to_probe: competencies })
                    }
                    placeholder="Add a competency"
                  />
                  <EditableList
                    label="Questions"
                    hint="Starter questions. The interviewer adapts from these."
                    items={plan.questions}
                    onChange={(questions) => patchPlan({ questions })}
                    placeholder="Add a question"
                    multiline
                  />
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] text-white/60">
                  <Sparkle className="h-4 w-4 text-purple-300" />
                  Estimated interview length:{" "}
                  <span className="font-mono text-white/85">
                    ~{durationMin} min
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <PHButton
                  variant="ghost"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  icon={<ChevronLeft />}
                >
                  Back
                </PHButton>
                <PHButton onClick={() => setStep(3)} iconRight={<ArrowRight />}>
                  Continue
                </PHButton>
              </div>
            </div>
          )}

          {/* STEP 3: LAUNCH */}
          {step === 3 && plan && (
            <div className="mt-7">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.005] p-5 sm:p-7">
                <div className="mb-5 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-purple-500/15 p-1.5 text-purple-300">
                    <Sparkle className="h-full w-full" />
                  </div>
                  <h2 className="text-[16px] font-medium tracking-tight sm:text-[18px]">
                    Launch
                  </h2>
                </div>

                {/* Link preview */}
                <div className="mb-6">
                  <div className="mb-1.5 text-[13px] font-medium text-white/70">
                    Candidate interview link
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                    <span className="truncate font-mono text-[13px] text-white/60">
                      {baseUrl}/i/
                      <span className="text-white/30">
                        (generated on create)
                      </span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-white/45">
                    Your shareable link appears on the role page right after you
                    create it.
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <PHInput
                      label="Expiration (optional)"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                    <p className="mt-1.5 text-[12px] text-white/45">
                      After this date, the link stops accepting new candidates.
                      Leave blank to keep it open.
                    </p>
                  </div>

                  <div>
                    <PHInput
                      label="Interview duration (minutes)"
                      type="number"
                      min={1}
                      max={180}
                      value={String(durationMin)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setDurationMin(Number.isFinite(n) ? n : 0);
                      }}
                    />
                    <p className="mt-1.5 text-[12px] text-white/45">
                      Target length the interviewer aims for.
                    </p>
                  </div>
                </div>

                {/* Allow retries toggle */}
                <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
                  <div>
                    <div className="text-[14px] font-medium text-white/85">
                      Allow retries
                    </div>
                    <p className="mt-0.5 text-[12px] text-white/45">
                      Saved with the role. Retry enforcement is coming soon.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowRetries}
                    onClick={() => setAllowRetries((v) => !v)}
                    className={[
                      "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                      allowRetries
                        ? "ph-grad-btn-bg"
                        : "bg-white/10 ring-1 ring-inset ring-white/15",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        allowRetries ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <PHButton
                  variant="ghost"
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  icon={<ChevronLeft />}
                >
                  Back
                </PHButton>
                <PHButton
                  onClick={create}
                  disabled={creating}
                  state={creating ? "loading" : "default"}
                  iconRight={creating ? undefined : <ArrowRight />}
                >
                  {creating ? "Creating…" : "Create role"}
                </PHButton>
              </div>
            </div>
          )}
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
    },
  };
};

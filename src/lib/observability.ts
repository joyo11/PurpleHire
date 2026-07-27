import { prisma } from "@/lib/prisma";

/**
 * Lightweight LLM observability for PurpleHire.
 *
 * Every model call (interview turns, JD analysis, scoring, TTS) is wrapped so
 * we capture the four things that matter in production: which model, how long
 * it took, how many tokens it used, and what it cost — plus success/failure.
 *
 * Two sinks, both best-effort so observability can NEVER break a real call:
 *   1. A structured JSON line on stdout — shows up in Vercel's log drain and is
 *      greppable ({"evt":"llm_call",...}). This works with zero infra.
 *   2. A row in the LlmCall table — powers the admin /stats "AI health" panel.
 *
 * If the DB write fails (e.g. the table isn't migrated yet), we swallow it and
 * still emit the log line, so this is safe to ship ahead of the migration.
 */

export type LlmOperation =
  | "interview_turn"
  | "jd_analysis"
  | "interview_score"
  | "tts";

/* USD price per 1M tokens (chat) or per 1M characters (tts).
   Update here if OpenAI pricing changes. */
const PRICING: Record<string, { in: number; out: number; perChar?: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  // Newer OpenAI line — drop-in upgrades from 4o via OPENAI_*_MODEL env vars.
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
  "tts-1": { in: 0, out: 0, perChar: 15 }, // $15 / 1M characters
  "tts-1-hd": { in: 0, out: 0, perChar: 30 },
};

/* Alert when a single call is slower than this. Cheap, log-based alerting —
   grep {"evt":"llm_alert"} or point a Vercel/Datadog log monitor at it. */
const SLOW_MS: Record<LlmOperation, number> = {
  interview_turn: 8000,
  jd_analysis: 12000,
  interview_score: 15000,
  tts: 6000,
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
  chars = 0,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  const tokenCost =
    (promptTokens / 1_000_000) * p.in + (completionTokens / 1_000_000) * p.out;
  const charCost = p.perChar ? (chars / 1_000_000) * p.perChar : 0;
  return Number((tokenCost + charCost).toFixed(6));
}

type RecordArgs = {
  operation: LlmOperation;
  model: string;
  ok: boolean;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  chars?: number;
  error?: string | null;
};

export async function recordLlm(args: RecordArgs): Promise<void> {
  const promptTokens = args.promptTokens ?? 0;
  const completionTokens = args.completionTokens ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const costUsd = estimateCostUsd(
    args.model,
    promptTokens,
    completionTokens,
    args.chars ?? 0,
  );

  // 1) structured log line (always) — safe to parse from log drains.
  const base = {
    evt: "llm_call",
    op: args.operation,
    model: args.model,
    ok: args.ok,
    latencyMs: args.latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    ...(args.error ? { error: args.error.slice(0, 300) } : {}),
  };
  console.log(JSON.stringify(base));

  // Alert on failures and slow calls so a log monitor can page on them.
  if (!args.ok || args.latencyMs > SLOW_MS[args.operation]) {
    console.warn(
      JSON.stringify({
        ...base,
        evt: "llm_alert",
        reason: !args.ok ? "error" : "slow",
      }),
    );
  }

  // 2) DB row (best-effort) — never let telemetry break the request.
  try {
    await prisma.llmCall.create({
      data: {
        operation: args.operation,
        model: args.model,
        ok: args.ok,
        latencyMs: Math.round(args.latencyMs),
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        error: args.error ? args.error.slice(0, 500) : null,
      },
    });
  } catch {
    // table not migrated yet, or DB hiccup — logging above is enough.
  }
}

/**
 * Wrap an LLM call: times it, records success/failure, and re-throws so callers
 * keep their existing control flow. `usage` pulls token/char counts off the
 * result for costing (return {} if the SDK gave none).
 */
export async function withLlmSpan<T>(
  operation: LlmOperation,
  model: string,
  fn: () => Promise<T>,
  usage: (result: T) => { promptTokens?: number; completionTokens?: number; chars?: number },
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    const u = usage(result);
    await recordLlm({
      operation,
      model,
      ok: true,
      latencyMs: Date.now() - started,
      promptTokens: u.promptTokens,
      completionTokens: u.completionTokens,
      chars: u.chars,
    });
    return result;
  } catch (err) {
    await recordLlm({
      operation,
      model,
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

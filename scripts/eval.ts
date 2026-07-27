/**
 * PurpleHire model eval harness.  Run:  npm run eval
 *
 * WHAT IT DOES
 * Pulls a sample of real, already-scored interviews from the database and
 * re-scores each transcript under two models side by side (a baseline and a
 * candidate model). It then prints how they compare on the things that decide
 * whether a model swap is safe:
 *   - validity     : did the model return valid JSON with a 1-10 score
 *   - agreement    : how far the two models' scores drift apart (mean / max |A-B|)
 *   - decision flip : how often they land on opposite sides of the 6.0 "advance"
 *                     line — the metric that actually changes a hiring outcome
 *   - drift vs prod : how far each lands from the score already stored in the DB
 *   - latency, cost : per model, so "better" is weighed against speed and spend
 *
 * So you flip a model with evidence, not a hunch.
 *
 * CONFIG (env vars, all optional)
 *   EVAL_MODEL_A   baseline model      (default: current scoring model)
 *   EVAL_MODEL_B   candidate model     (default: gpt-4.1-mini)
 *   EVAL_SAMPLE    how many interviews (default: 25)
 * Needs DATABASE_URL and OPENAI_API_KEY in the environment (they live in
 * Vercel, not .env.local — pull them with `vercel env pull` or export manually).
 *
 * SCOPE — read this: this evaluates the SCORING step, which is a clean
 * transcript-in / score-out comparison. It does NOT evaluate the live interview
 * brain (gpt-4o), because that needs a candidate simulator to replay a branching
 * conversation — that's the natural phase 2. See notes at the end of the run.
 */
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { estimateCostUsd } from "@/lib/observability";
import { MODELS } from "@/lib/models";
import { SCORING_SYSTEM, buildScoringUserPrompt } from "@/lib/scoringPrompt";
import type { InterviewPlan } from "@/lib/jdAnalyzer";

const MODEL_A = process.env.EVAL_MODEL_A || MODELS.scoring;
const MODEL_B = process.env.EVAL_MODEL_B || "gpt-4.1-mini";
const SAMPLE = Number(process.env.EVAL_SAMPLE || 25);
const ADVANCE_LINE = 6.0; // scores at/above this are "advance the candidate"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

type Scored = {
  score: number | null;
  valid: boolean;
  latencyMs: number;
  costUsd: number;
  error?: string;
};

async function scoreWith(model: string, userPrompt: string): Promise<Scored> {
  const t0 = Date.now();
  try {
    const c = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SCORING_SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });
    const latencyMs = Date.now() - t0;
    const raw = c.choices[0]?.message?.content ?? "";
    const costUsd = estimateCostUsd(
      model,
      c.usage?.prompt_tokens ?? 0,
      c.usage?.completion_tokens ?? 0,
    );
    try {
      const o = JSON.parse(raw) as { score?: unknown; verdict?: unknown };
      if (typeof o.score === "number" && o.score >= 1 && o.score <= 10) {
        return { score: o.score, valid: true, latencyMs, costUsd };
      }
    } catch {
      /* invalid JSON — falls through to invalid */
    }
    return { score: null, valid: false, latencyMs, costUsd };
  } catch (err) {
    return {
      score: null,
      valid: false,
      latencyMs: Date.now() - t0,
      costUsd: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function pct(n: number, d: number): string {
  return d ? `${((n / d) * 100).toFixed(0)}%` : "—";
}
function usd(n: number): string {
  return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL not set. Run `vercel env pull` first.");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("✗ OPENAI_API_KEY not set. Export it or `vercel env pull`.");
    process.exit(1);
  }

  console.log(`\nPurpleHire model eval — scoring step`);
  console.log(`  baseline (A): ${MODEL_A}`);
  console.log(`  candidate (B): ${MODEL_B}`);
  console.log(`  sample: up to ${SAMPLE} scored interviews\n`);

  const conversations = await prisma.conversation.findMany({
    where: {
      status: "completed",
      candidate: { is: { score: { not: null } } },
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      candidate: { include: { role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: SAMPLE,
  });

  const usable = conversations.filter((c) => c.candidate?.role && c.messages.length > 0);
  if (usable.length === 0) {
    console.error(
      "✗ No scored interviews with transcripts found. Nothing to evaluate yet.",
    );
    process.exit(1);
  }

  const diffsAB: number[] = [];
  const driftA: number[] = [];
  const driftB: number[] = [];
  const latA: number[] = [];
  const latB: number[] = [];
  let validA = 0,
    validB = 0,
    flips = 0,
    costA = 0,
    costB = 0,
    errA = 0,
    errB = 0;

  let i = 0;
  for (const conv of usable) {
    i++;
    const role = conv.candidate!.role!;
    let plan: InterviewPlan | null = null;
    try {
      plan = JSON.parse(role.interviewPlan) as InterviewPlan;
    } catch {
      plan = null;
    }
    const userPrompt = buildScoringUserPrompt({
      roleTitle: role.title,
      jdText: role.jdText,
      plan,
      messages: conv.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      endReason: conv.endReason,
    });

    const [a, b] = await Promise.all([
      scoreWith(MODEL_A, userPrompt),
      scoreWith(MODEL_B, userPrompt),
    ]);

    const ref = conv.candidate!.score as number;
    if (a.error) errA++;
    if (b.error) errB++;
    if (a.valid) validA++;
    if (b.valid) validB++;
    costA += a.costUsd;
    costB += b.costUsd;
    latA.push(a.latencyMs);
    latB.push(b.latencyMs);

    if (a.valid && b.valid) {
      const d = Math.abs((a.score as number) - (b.score as number));
      diffsAB.push(d);
      const aAdv = (a.score as number) >= ADVANCE_LINE;
      const bAdv = (b.score as number) >= ADVANCE_LINE;
      if (aAdv !== bAdv) flips++;
    }
    if (a.valid) driftA.push(Math.abs((a.score as number) - ref));
    if (b.valid) driftB.push(Math.abs((b.score as number) - ref));

    process.stdout.write(
      `  [${i}/${usable.length}] ref ${ref.toFixed(1)}  |  A ${a.valid ? (a.score as number).toFixed(1) : "err"}  B ${b.valid ? (b.score as number).toFixed(1) : "err"}\n`,
    );
  }

  const n = usable.length;
  const bothValid = diffsAB.length;

  const rows: [string, string, string][] = [
    ["metric", `A · ${MODEL_A}`, `B · ${MODEL_B}`],
    ["interviews scored", String(n), String(n)],
    ["valid JSON in range", pct(validA, n), pct(validB, n)],
    ["errors", String(errA), String(errB)],
    ["avg latency", `${(mean(latA) / 1000).toFixed(2)}s`, `${(mean(latB) / 1000).toFixed(2)}s`],
    ["total cost", usd(costA), usd(costB)],
    ["cost / interview", usd(costA / n), usd(costB / n)],
    ["mean drift vs prod score", driftA.length ? mean(driftA).toFixed(2) : "—", driftB.length ? mean(driftB).toFixed(2) : "—"],
  ];

  const w0 = Math.max(...rows.map((r) => r[0].length));
  const w1 = Math.max(...rows.map((r) => r[1].length));
  const w2 = Math.max(...rows.map((r) => r[2].length));
  console.log("\n" + "─".repeat(w0 + w1 + w2 + 6));
  rows.forEach((r, idx) => {
    console.log(`${r[0].padEnd(w0)}  ${r[1].padEnd(w1)}  ${r[2].padEnd(w2)}`);
    if (idx === 0) console.log("─".repeat(w0 + w1 + w2 + 6));
  });
  console.log("─".repeat(w0 + w1 + w2 + 6));

  console.log(`\nA vs B agreement (both valid, n=${bothValid}):`);
  console.log(`  mean |A-B| score gap : ${bothValid ? mean(diffsAB).toFixed(2) : "—"}`);
  console.log(`  max  |A-B| score gap : ${bothValid ? Math.max(...diffsAB).toFixed(2) : "—"}`);
  console.log(
    `  advance-line flips   : ${flips}/${bothValid} (${pct(flips, bothValid)}) — cases where one model says advance and the other says pass`,
  );

  // Verdict heuristic to guide the read.
  console.log(`\nRead:`);
  const gap = bothValid ? mean(diffsAB) : Infinity;
  if (validB < validA) {
    console.log(`  ⚠ B produced fewer valid outputs than A — reliability regression, do NOT flip.`);
  } else if (flips / Math.max(1, bothValid) > 0.15) {
    console.log(`  ⚠ B flips >15% of advance decisions vs A — too much behavior change to flip blind.`);
  } else if (gap <= 1.0) {
    console.log(`  ✓ B agrees closely with A (gap ≤ 1.0) and stayed valid — safe to flip if latency/cost look good above.`);
  } else {
    console.log(`  ~ B is directionally similar but scores drift ${gap.toFixed(2)} on average — eyeball a few transcripts before flipping.`);
  }

  console.log(
    `\nNote: this eval covers the SCORING model only. Evaluating the live\n` +
      `interview brain (${MODELS.interview}) needs a candidate simulator to replay a\n` +
      `branching conversation — that's phase 2. For now, spot-check a few live\n` +
      `interviews manually before changing OPENAI_INTERVIEW_MODEL.\n`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

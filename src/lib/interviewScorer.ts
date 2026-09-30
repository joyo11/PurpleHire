import OpenAI from "openai";
import { prisma } from "./prisma";
import type { InterviewPlan } from "./jdAnalyzer";
import { withLlmSpan } from "@/lib/observability";
import { MODELS } from "@/lib/models";
import {
  SCORING_SYSTEM,
  buildScoringUserPrompt,
  type TranscriptMessage,
} from "@/lib/scoringPrompt";
import {
  DEFAULT_COMPETENCIES,
  recommendationFromScore,
  type CompetencyScore,
  type Confidence,
  type EvaluationReport,
  type EvidencePoint,
  type PerQuestionAssessment,
  type Recommendation,
} from "@/lib/evaluationReport";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

export type ScoreResult = {
  score: number | null;
  verdict: string;
  report: EvaluationReport;
};

const RECOMMENDATIONS: Recommendation[] = [
  "Strong match",
  "Possible match",
  "Weak match",
  "Not enough evidence",
];
const CONFIDENCES: Confidence[] = ["high", "medium", "low"];

/** End reasons that signal an interview cut short rather than run to completion. */
const EARLY_END_REASONS = new Set(["candidate_ended", "inactive", "turn_limit"]);

/** End reasons that ALWAYS mean the interview is incomplete, regardless of how
 *  many questions were answered: the candidate explicitly left, or the session
 *  was interrupted (disconnected/idle). These must never yield a numeric score. */
const FORCE_INCOMPLETE_REASONS = new Set([
  "candidate_left",
  "disconnected",
  "inactive",
]);

/** Count candidate turns that carry real content (not a one-word "ok" / blank). */
function countSubstantiveAnswers(messages: TranscriptMessage[]): number {
  return messages.filter(
    (m) => m.role === "user" && m.content.trim().split(/\s+/).length >= 4,
  ).length;
}

/** Heuristic: is there too little to fairly judge the candidate? Used for the
 *  fallback report when the model JSON is unusable, and as a guardrail so an
 *  early exit never lands a punishing low score. */
function looksIncomplete(
  messages: TranscriptMessage[],
  endReason: string | null,
): boolean {
  if (endReason && FORCE_INCOMPLETE_REASONS.has(endReason)) return true;
  const substantive = countSubstantiveAnswers(messages);
  if (substantive < 3) return true;
  if (endReason && EARLY_END_REASONS.has(endReason) && substantive < 4)
    return true;
  return false;
}

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const v = Math.max(1, Math.min(10, n));
  return Math.round(v * 10) / 10;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => (x as string).trim())
    .filter(Boolean);
}

/** Force the breakdown to contain all 5 default competencies in canonical
 *  order, carrying through any scores the model provided (matched by key). */
function normalizeBreakdown(v: unknown): CompetencyScore[] {
  const byKey = new Map<string, number | null>();
  if (Array.isArray(v)) {
    for (const item of v) {
      if (item && typeof item === "object") {
        const key = (item as { key?: unknown }).key;
        if (typeof key === "string") {
          byKey.set(key, clampScore((item as { score?: unknown }).score));
        }
      }
    }
  }
  return DEFAULT_COMPETENCIES.map((c) => ({
    key: c.key,
    label: c.label,
    score: byKey.has(c.key) ? (byKey.get(c.key) ?? null) : null,
  }));
}

function normalizeEvidence(v: unknown): EvidencePoint[] {
  if (!Array.isArray(v)) return [];
  const out: EvidencePoint[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const point = (item as { point?: unknown }).point;
    if (typeof point !== "string" || !point.trim()) continue;
    const quote = (item as { quote?: unknown }).quote;
    out.push({
      point: point.trim(),
      ...(typeof quote === "string" && quote.trim()
        ? { quote: quote.trim() }
        : {}),
    });
  }
  return out;
}

function normalizePerQuestion(v: unknown): PerQuestionAssessment[] {
  if (!Array.isArray(v)) return [];
  const out: PerQuestionAssessment[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const question = (item as { question?: unknown }).question;
    const assessment = (item as { assessment?: unknown }).assessment;
    if (typeof question !== "string" || typeof assessment !== "string") continue;
    out.push({
      question: question.trim(),
      assessment: assessment.trim(),
      score: clampScore((item as { score?: unknown }).score),
    });
  }
  return out;
}

function intOr(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  return fallback;
}

/** Build a valid-but-minimal report when the model JSON is missing/malformed.
 *  Never throws, always satisfies the EvaluationReport contract. */
function buildFallbackReport(
  messages: TranscriptMessage[],
  endReason: string | null,
  plan: InterviewPlan | null,
): { score: number | null; verdict: string; report: EvaluationReport } {
  const incomplete = looksIncomplete(messages, endReason);
  const questionCount = messages.filter((m) => m.role === "assistant").length;
  const mustHaveTotal = plan?.must_haves.length ?? 0;
  const verdict = incomplete
    ? `Interview ended after ${questionCount} ${
        questionCount === 1 ? "question" : "questions"
      }. Insufficient evidence was collected to evaluate the candidate against the role requirements.`
    : "Automated scoring could not produce a full report for this transcript; a human review is recommended.";

  const report: EvaluationReport = {
    version: 1,
    incomplete,
    recommendation: "Not enough evidence",
    keySignal: incomplete
      ? "Interview ended early; not enough evidence to judge."
      : "Report unavailable; manual review recommended.",
    confidence: "low",
    competenciesAssessed: 0,
    competenciesTotal: DEFAULT_COMPETENCIES.length,
    mustHaveCovered: 0,
    mustHaveTotal,
    breakdown: DEFAULT_COMPETENCIES.map((c) => ({
      key: c.key,
      label: c.label,
      score: null,
    })),
    strengths: [],
    concerns: [],
    evidence: [],
    perQuestion: [],
  };

  return { score: null, verdict, report };
}

/** Coerce the raw parsed model object into a valid ScoreResult. Never throws. */
function coerceResult(
  obj: unknown,
  messages: TranscriptMessage[],
  endReason: string | null,
  plan: InterviewPlan | null,
): ScoreResult {
  if (!obj || typeof obj !== "object") {
    return buildFallbackReport(messages, endReason, plan);
  }
  const o = obj as Record<string, unknown>;

  const verdict =
    typeof o.verdict === "string" && o.verdict.trim()
      ? o.verdict.trim()
      : null;
  if (!verdict) {
    return buildFallbackReport(messages, endReason, plan);
  }

  const heuristicIncomplete = looksIncomplete(messages, endReason);
  // The model's own incomplete flag OR our guardrail — either one forces the
  // non-punishing incomplete path so an early exit is never scored as a "2.0".
  const incomplete =
    o.incomplete === true ||
    (typeof o.score !== "number" && o.score === null) ||
    heuristicIncomplete;

  let score = clampScore(o.score);
  if (incomplete) score = null;

  const breakdown = normalizeBreakdown(o.breakdown);
  const assessedFromBreakdown = breakdown.filter((b) => b.score !== null).length;

  let recommendation: Recommendation = RECOMMENDATIONS.includes(
    o.recommendation as Recommendation,
  )
    ? (o.recommendation as Recommendation)
    : recommendationFromScore(score);
  if (incomplete) recommendation = "Not enough evidence";

  const confidence: Confidence = incomplete
    ? "low"
    : CONFIDENCES.includes(o.confidence as Confidence)
      ? (o.confidence as Confidence)
      : "medium";

  const mustHaveTotal = intOr(o.mustHaveTotal, plan?.must_haves.length ?? 0);
  const mustHaveCovered = incomplete
    ? 0
    : Math.min(intOr(o.mustHaveCovered, 0), mustHaveTotal || Infinity);

  const keySignal =
    typeof o.keySignal === "string" && o.keySignal.trim()
      ? o.keySignal.trim()
      : incomplete
        ? "Interview ended early; not enough evidence to judge."
        : verdict;

  const report: EvaluationReport = {
    version: 1,
    incomplete,
    recommendation,
    keySignal,
    confidence,
    competenciesAssessed: incomplete
      ? assessedFromBreakdown
      : intOr(o.competenciesAssessed, assessedFromBreakdown),
    competenciesTotal: intOr(o.competenciesTotal, DEFAULT_COMPETENCIES.length),
    mustHaveCovered,
    mustHaveTotal,
    breakdown,
    strengths: asStringArray(o.strengths),
    concerns: asStringArray(o.concerns),
    evidence: normalizeEvidence(o.evidence),
    perQuestion: normalizePerQuestion(o.perQuestion),
  };

  return { score, verdict, report };
}

/** Pure scoring — no DB. Reusable by both real interviews and the demo flow. */
export async function scoreTranscript({
  roleTitle,
  jdText,
  plan,
  messages,
  endReason,
}: {
  roleTitle: string;
  jdText: string;
  plan: InterviewPlan | null;
  messages: TranscriptMessage[];
  endReason: string | null;
}): Promise<ScoreResult | null> {
  const userPrompt = buildScoringUserPrompt({
    roleTitle,
    jdText,
    plan,
    messages,
    endReason,
  });

  const completion = await withLlmSpan(
    "interview_score",
    MODELS.scoring,
    () =>
      openai.chat.completions.create({
        model: MODELS.scoring,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SCORING_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    (c) => ({
      promptTokens: c.usage?.prompt_tokens,
      completionTokens: c.usage?.completion_tokens,
    }),
  );

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  // coerceResult never throws and always returns a valid report — falling back
  // to a minimal report when the JSON is missing or malformed.
  return coerceResult(parsed, messages, endReason, plan);
}

/** DB-backed scoring used by /api/chat when an interview completes. */
export async function scoreInterview(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      candidate: { include: { role: true } },
    },
  });

  if (!conversation?.candidate?.role) return;

  const role = conversation.candidate.role;
  let plan: InterviewPlan | null = null;
  try {
    plan = JSON.parse(role.interviewPlan) as InterviewPlan;
  } catch {
    plan = null;
  }

  const result = await scoreTranscript({
    roleTitle: role.title,
    jdText: role.jdText,
    plan,
    messages: conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    endReason: conversation.endReason,
  });
  if (!result) return;

  // Deterministic evidence gaps from the server-authoritative coverage map:
  // list must-have competencies the interview never gathered enough evidence on,
  // so the recruiter report is explicit about what was NOT assessed (rather than
  // relying on the model to notice). Sourced from truth (metadata), not the LLM.
  try {
    const meta = JSON.parse(conversation.metadata || "{}") as {
      coverage?: Record<string, string>;
    };
    const coverage = meta.coverage ?? {};
    const mustHaves = plan?.must_haves ?? [];
    const gaps = mustHaves.filter((_, i) => {
      const ev = coverage[String(i)];
      return ev !== "some" && ev !== "strong";
    });
    if (gaps.length && mustHaves.length) {
      const gapNote = `Evidence gaps: the interview did not gather sufficient evidence on ${gaps.join(", ")}.`;
      if (!result.report.concerns.some((c) => c.startsWith("Evidence gaps:"))) {
        result.report.concerns = [gapNote, ...result.report.concerns];
      }
    }
  } catch {
    // best-effort; if metadata is unreadable, skip the deterministic gap note.
  }

  await prisma.candidate.update({
    where: { id: conversation.candidate.id },
    data: {
      score: result.score,
      verdict: result.verdict,
      report: JSON.stringify(result.report),
      scoredAt: new Date(),
    },
  });
}

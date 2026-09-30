/**
 * Server-authoritative, deterministic interview completion logic.
 *
 * The LLM only REPORTS signals (which competency an answer addressed, how strong
 * the evidence was) and RECOMMENDS a next action. It can never itself terminate
 * the interview. This module is the single source of truth for:
 *   - when the interview is complete (coverage / diminishing returns / hard cap)
 *   - readiness classification at the welcome gate
 *   - evidence bookkeeping (skips and non-answers never count as evidence)
 *
 * Everything here is pure and unit-tested (see interviewMachine.test.ts run in
 * CI-less fashion via tsx during development).
 */

export type EvidenceLevel = "none" | "weak" | "some" | "strong";

export const MIN_QUESTIONS = 5;
export const TARGET_MIN = 7;
export const TARGET_MAX = 10;
export const MAX_QUESTIONS = 14; // hard safety ceiling, NOT a target
export const FOLLOWUP_CAP = 2; // max follow-ups on a single competency
export const NO_IMPROVEMENT_LIMIT = 3; // consecutive no-gain turns -> wrap

const RANK: Record<EvidenceLevel, number> = {
  none: 0,
  weak: 1,
  some: 2,
  strong: 3,
};

/** Evidence at "some" or better counts as sufficient coverage of a competency. */
export function isSufficient(level: EvidenceLevel | undefined): boolean {
  return level === "some" || level === "strong";
}

/** Coverage only ever moves up: a later weak answer can't erase earlier strong
 *  evidence for the same competency. */
export function mergeEvidence(
  prev: EvidenceLevel | undefined,
  next: EvidenceLevel,
): EvidenceLevel {
  const p = prev ? RANK[prev] : 0;
  return RANK[next] > p ? next : (prev ?? next);
}

export type Coverage = Record<string, EvidenceLevel>;

/** All required competencies have at least "some" evidence. */
export function requiredCovered(
  coverage: Coverage,
  requiredIds: string[],
): boolean {
  if (requiredIds.length === 0) return true;
  return requiredIds.every((id) => isSufficient(coverage[id]));
}

/** Competencies that still lack sufficient evidence (the report's "gaps"). */
export function uncoveredRequired(
  coverage: Coverage,
  requiredIds: string[],
): string[] {
  return requiredIds.filter((id) => !isSufficient(coverage[id]));
}

export type CompletionReason = "coverage" | "diminishing" | "max" | null;

export type MachineState = {
  questionsAsked: number;
  coverage: Coverage;
  requiredIds: string[];
  noImprovementStreak: number;
};

/**
 * Deterministic completion decision. The model's recommendation is advisory
 * only: this function, not the model, decides. Order matters:
 *   1. Hard cap always ends (even with gaps -> report flags them).
 *   2. Below MIN we NEVER complete, no matter what the model wants.
 *   3. At/after MIN: complete when all required competencies are covered, or
 *      when probing has stopped adding evidence (diminishing returns).
 */
export function decideCompletion(state: MachineState): {
  complete: boolean;
  reason: CompletionReason;
} {
  const { questionsAsked, coverage, requiredIds, noImprovementStreak } = state;

  if (questionsAsked >= MAX_QUESTIONS) {
    return { complete: true, reason: "max" };
  }
  if (questionsAsked < MIN_QUESTIONS) {
    return { complete: false, reason: null };
  }
  if (requiredCovered(coverage, requiredIds)) {
    return { complete: true, reason: "coverage" };
  }
  if (noImprovementStreak >= NO_IMPROVEMENT_LIMIT) {
    return { complete: true, reason: "diminishing" };
  }
  return { complete: false, reason: null };
}

/** Can we still usefully follow up on this competency, or have we hit the
 *  per-competency cap (so we should move on and not pressure the candidate)? */
export function canFollowUp(
  followups: Record<string, number>,
  competencyId: string,
): boolean {
  return (followups[competencyId] ?? 0) < FOLLOWUP_CAP;
}

export type Readiness = "ready" | "not_ready" | "unclear";

/**
 * Classify the candidate's reply to the opening "ready to start?" gate. This is
 * NOT an interview question, so "no" here means "not yet", never "end".
 */
export function classifyReadiness(text: string): Readiness {
  const n = (text || "").trim().toLowerCase().replace(/[’]/g, "'");
  if (!n) return "unclear";

  if (
    /^(yes|yep|yeah|yup|ready|sure|ok|okay|k|let'?s go|let'?s do it|i'?m ready|im ready|absolutely|go|start|begin|sounds good|ready to go|lets start|let'?s start)\b/.test(
      n,
    )
  ) {
    return "ready";
  }
  if (
    /^(no|nope|nah|not yet|not now|not really|hold on|hang on|wait|give me|one sec|one moment|a (minute|sec|second)|later|can we (do this |start )?(later|another time)|reschedule|not ready)\b/.test(
      n,
    )
  ) {
    return "not_ready";
  }
  // A substantive message (they just started talking) counts as ready.
  if (n.length >= 40) return "ready";
  return "unclear";
}

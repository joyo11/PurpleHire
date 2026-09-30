/**
 * Shared contract for the candidate evaluation report.
 *
 * The scorer (src/lib/interviewScorer.ts) PRODUCES an EvaluationReport and
 * stores it as JSON on Candidate.report. The dashboard, role page, and the
 * candidate report page all CONSUME it through this file. Keeping the type +
 * helpers in one place lets those surfaces be built independently without
 * guessing each other's shape.
 */

export type CompetencyKey =
  | "technical_expertise"
  | "relevant_experience"
  | "problem_solving"
  | "communication"
  | "role_requirements";

export type CompetencyScore = {
  key: CompetencyKey | string;
  label: string;
  /** 1.0-10.0, or null when this competency could not be assessed. */
  score: number | null;
};

export type EvidencePoint = {
  point: string;
  /** Optional short candidate quote backing the point. */
  quote?: string;
};

export type PerQuestionAssessment = {
  question: string;
  assessment: string;
  score?: number | null;
};

export type Recommendation =
  | "Strong match"
  | "Possible match"
  | "Weak match"
  | "Not enough evidence";

export type Confidence = "high" | "medium" | "low";

export type EvaluationReport = {
  version: 1;
  /** True when the interview was interrupted / too short to judge the
   *  candidate. When true, `score` on the Candidate should be null and the
   *  recommendation should be "Not enough evidence" (never a punishing low
   *  score for simply leaving early). */
  incomplete: boolean;
  recommendation: Recommendation;
  /** One-line headline signal, e.g. "Strong React architecture; testing depth
   *  needs validation." */
  keySignal: string;
  confidence: Confidence;
  competenciesAssessed: number;
  competenciesTotal: number;
  mustHaveCovered: number;
  mustHaveTotal: number;
  breakdown: CompetencyScore[];
  strengths: string[];
  concerns: string[];
  evidence: EvidencePoint[];
  perQuestion: PerQuestionAssessment[];
};

/** Safely parse the JSON stored on Candidate.report. Returns null when the
 *  field is empty or malformed (older candidates scored before reports). */
export function parseReport(raw: string | null | undefined): EvaluationReport | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && Array.isArray(obj.breakdown)) {
      return obj as EvaluationReport;
    }
  } catch {
    // fall through
  }
  return null;
}

/** The five default competencies, in display order. Agent A should score these
 *  (plus any extras) so the report page can render a stable layout. */
export const DEFAULT_COMPETENCIES: { key: CompetencyKey; label: string }[] = [
  { key: "technical_expertise", label: "Technical expertise" },
  { key: "relevant_experience", label: "Relevant experience" },
  { key: "problem_solving", label: "Problem solving" },
  { key: "communication", label: "Communication" },
  { key: "role_requirements", label: "Role requirements" },
];

/** Map a 1-10 score to a human recommendation label. `null` (incomplete or
 *  unscored) maps to "Not enough evidence". Bands match the scoring rubric:
 *  8-10 strong, 6-7.9 solid/possible, 4-5.9 weak, <4 clear no. */
export function recommendationFromScore(score: number | null): Recommendation {
  if (score === null) return "Not enough evidence";
  if (score >= 8) return "Strong match";
  if (score >= 6) return "Possible match";
  return "Weak match";
}

/** Short tier label for a score, aligned with the recruiter score explainer. */
export function tierFromScore(score: number | null): {
  label: string;
  /** tailwind color classes: bg + text + ring */
  cls: string;
} {
  if (score === null)
    return { label: "Incomplete", cls: "bg-white/10 text-white/60 ring-white/15" };
  if (score >= 8)
    return {
      label: "Strong fit",
      cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    };
  if (score >= 6)
    return {
      label: "Solid, leaning yes",
      cls: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
    };
  if (score >= 4)
    return {
      label: "Mixed signal",
      cls: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
    };
  return {
    label: "Likely no",
    cls: "bg-red-500/15 text-red-300 ring-red-500/30",
  };
}

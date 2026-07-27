import type { InterviewPlan } from "./jdAnalyzer";

/**
 * The scoring prompt, extracted so the live scorer (interviewScorer.ts) and the
 * offline eval harness (scripts/eval.ts) share ONE definition. If this drifts
 * between the two, the eval stops measuring what production actually does — so
 * both import from here, never copy it.
 */

export const SCORING_SYSTEM = `You are an experienced hiring manager evaluating an AI-conducted interview transcript.

Given a job description, the interview plan the bot followed, and the full transcript, score the candidate from 1.0 to 10.0 with one decimal place (e.g. 7.4, 8.7, 9.2):
- 1.0–3.9: Clear no — missing must-haves, red flags hit, or interview ended early in a bad way.
- 4.0–5.9: Mixed signal — some skills present, some gaps; would need a human follow-up to decide.
- 6.0–7.9: Solid yes-leaning — most must-haves covered with credible answers; some thin spots.
- 8.0–10.0: Strong candidate — clear must-have coverage, real depth, no concerns. Recruiter should advance.

Use the full granularity (avoid lazy round numbers like 7.0, 8.0 unless that's truly the right score).

Also produce a one-sentence verdict (max 25 words) the recruiter can scan, explaining the score.

Return STRICT JSON: { "score": <number 1.0-10.0>, "verdict": "<one sentence>" }`;

export type TranscriptMessage = { role: "user" | "assistant"; content: string };

export function buildScoringUserPrompt({
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
}): string {
  const transcript = messages
    .map(
      (m) =>
        `${m.role === "assistant" ? "Interviewer (PurpleHire)" : "Candidate"}: ${m.content}`,
    )
    .join("\n\n");

  return `# Role
${roleTitle}

# Job description
${jdText}

${
  plan
    ? `# Interview plan the bot followed
Must-haves: ${plan.must_haves.join(", ") || "(none)"}
Skills probed: ${plan.skills_to_probe.join(", ") || "(none)"}
Red flags watched: ${plan.red_flags.join(", ") || "(none)"}
`
    : ""
}# Transcript
${transcript}

# End reason
${endReason ?? "unknown"}`;
}

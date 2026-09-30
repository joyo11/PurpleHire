/**
 * Lightweight, non-invasive anti-cheat signals. We never screen-record; we
 * derive an "AI-assist risk" hint from behaviour the browser already exposes:
 * leaving the interview tab, and pasting large blocks of text into the answer
 * box (the classic ChatGPT-in-another-tab -> copy -> paste pattern).
 *
 * This is a HINT for the recruiter, not a verdict. A candidate may legitimately
 * paste a code snippet or step away once. We surface evidence and let the human
 * decide.
 */

export type AiAssistRisk = "low" | "medium" | "high";

/** A single large paste into the answer box (chars). Below this we assume it's
 *  normal typing/editing and don't flag it. */
export const LARGE_PASTE_CHARS = 240;

export function aiAssistRisk(args: {
  tabSwitches: number;
  pasteCount: number;
}): AiAssistRisk {
  const { tabSwitches, pasteCount } = args;
  // Pastes are the stronger signal; tab leaves are softer (could be a
  // notification, a phone call). Weight accordingly.
  const score = pasteCount * 2 + tabSwitches;
  if (pasteCount >= 2 || score >= 5) return "high";
  if (pasteCount >= 1 || tabSwitches >= 2) return "medium";
  return "low";
}

export function riskLabel(risk: AiAssistRisk): string {
  return risk === "high"
    ? "AI-assist risk: high"
    : risk === "medium"
      ? "AI-assist risk: medium"
      : "AI-assist risk: low";
}

/** Tailwind classes (bg + text + ring) for the risk badge. */
export function riskBadgeClasses(risk: AiAssistRisk): string {
  return risk === "high"
    ? "bg-red-500/15 text-red-300 ring-red-500/30"
    : risk === "medium"
      ? "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30"
      : "bg-white/10 text-white/50 ring-white/15";
}

/**
 * Candidate-intent classifier for the interview-ending state machine.
 *
 * The server (never the model, never the bot's own prose) decides whether a
 * candidate turn should end the interview. This runs on the candidate's most
 * recent message and returns one of:
 *
 *   "explicit_end" — an unambiguous first-person request to end the WHOLE
 *                    interview ("end the interview", "I withdraw", "I'm done").
 *                    Honored immediately.
 *   "leave"        — an AMBIGUOUS "I might be leaving / I'm frustrated / I'd
 *                    rather not" signal ("no", "not interested", profanity,
 *                    "can I speak instead"). NEVER ends; routes to a
 *                    clarification turn offering three choices.
 *   null           — everything else, including a single declined question
 *                    ("skip", "next", "I don't know"). The interview continues;
 *                    the model handles skips conversationally.
 *
 * Ambiguity ALWAYS defaults to staying in the interview. A single short reply
 * can never terminate. Used by /api/chat and /api/demo/chat so both behave the
 * same way.
 */
export type CandidateIntent = "explicit_end" | "leave" | null;

export function classifyCandidateIntent(text: string): CandidateIntent {
  const n = (text || "").trim().toLowerCase().replace(/’/g, "'");
  if (!n) return null;

  // EXPLICIT end of the WHOLE interview — honored immediately, no clarification.
  const explicitEnd =
    /\b(end|stop|cancel|quit|terminate)\s+(the|this)\s+(interview|screening|call)\b/.test(n) ||
    /\bi\s+withdraw\b/.test(n) ||
    /\bwithdraw\s+my\s+application\b/.test(n) ||
    /\bi'?m\s+withdrawing\b/.test(n) ||
    /\bi\s+(?:quit|resign)\b/.test(n) ||
    /\bi'?m\s+not\s+interested\s+in\s+(the|this)\s+(job|role|position|opportunity)\b/.test(n) ||
    /\bi\s+(?:have|need)\s+to\s+(?:go|leave)\b/.test(n) ||
    /\bi'?ve\s+got\s+to\s+go\b/.test(n) ||
    /\bi\s+gotta\s+go\b/.test(n) ||
    /^i'?m\s+done[.!]?$/.test(n);
  if (explicitEnd) return "explicit_end";

  // AMBIGUOUS "leaving" signals — NEVER end; route to a clarification turn.
  const leave =
    /^(no|nope|nah|no\s*thanks?|not\s*really|no\s*way)[.!]?$/.test(n) ||
    /\bnot\s+interested\b/.test(n) || // bare, not tied to "the job" above
    /\b(this\s+is\s+(stupid|pointless|dumb|useless|a\s+waste)|waste\s+of\s+(my\s+)?time|this\s+sucks)\b/.test(n) ||
    /\b(f+u+c+k|bull\s*shit|wtf|screw\s+this|this\s+is\s+bs)\b/.test(n) ||
    /\b(can|could)\s+(i|we)\s+(speak|talk|call|do\s+(?:this\s+)?(?:by\s+|over\s+)?(?:a\s+)?(?:voice|phone|call))\b/.test(n) ||
    /\bi'?d\s+(?:rather|prefer\s+to|like\s+to)\s+(?:speak|talk|call|use\s+voice|do\s+(?:this\s+)?(?:by\s+|over\s+)?(?:voice|phone))\b/.test(n) ||
    /\b(another|different)\s+(input\s+)?method\b/.test(n) ||
    /\b(voice|phone\s+call)\s+(instead|please)\b/.test(n) ||
    /^(i\s+want\s+to\s+stop|can\s+we\s+stop|stop)[.!]?$/.test(n);
  if (leave) return "leave";

  return null;
}

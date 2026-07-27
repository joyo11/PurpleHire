/**
 * Single source of truth for which model each PurpleHire operation uses.
 *
 * Previously these strings were hardcoded across four files, so upgrading the
 * model meant hunting them down one by one. Now it's one place, and each is
 * overridable by an env var — so you can move to a newer model in Vercel
 * without a code change or redeploy of logic:
 *
 *   OPENAI_INTERVIEW_MODEL   → the interview brain (quality + tool-calling)
 *   OPENAI_UTILITY_MODEL     → JD analysis + scoring (cheap, structured JSON)
 *   OPENAI_TTS_MODEL         → voice
 *
 * Defaults stay on the proven models so nothing changes until you opt in.
 * Recommended upgrade path: set OPENAI_INTERVIEW_MODEL to a newer model,
 * run the eval harness (npm run eval) to confirm it's actually better on past
 * interviews, THEN keep it. Cost tracking in observability.ts already knows
 * the gpt-4.1 family, so the /stats spend numbers keep working after a swap.
 */
export const MODELS = {
  interview: process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o",
  jdAnalysis: process.env.OPENAI_UTILITY_MODEL || "gpt-4o-mini",
  scoring: process.env.OPENAI_UTILITY_MODEL || "gpt-4o-mini",
  tts: process.env.OPENAI_TTS_MODEL || "tts-1",
} as const;

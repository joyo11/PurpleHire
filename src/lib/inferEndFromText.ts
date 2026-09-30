/**
 * Safety net for the known LLM tic where the bot writes an obvious
 * closing line ("really enjoyed our chat", "have a great day") but
 * forgets to fire the end_interview tool in the same turn.
 *
 * Given the bot's most recent reply and the candidate's most recent
 * message, return an inferred end reason or undefined if the bot
 * didn't actually say goodbye. False positives only end an interview
 * the bot was already trying to end, so the risk is low.
 *
 * Used by both the real interview flow (/api/chat) and the public
 * demo flow (/api/demo/chat) so both behave the same way.
 */
export function inferEndFromText(
  botText: string,
  userText: string,
): string | undefined {
  const b = botText.toLowerCase();
  const u = userText.toLowerCase();

  // Reschedule signals from the bot's closing or the candidate's message.
  // Checked BEFORE the generic wrap-phrase logic because "link stays active"
  // and "come back whenever" also overlap with generic wrap language.
  const botSaidReschedule =
    /(link stays active|come back whenever|come back when you'?re ready|whenever you'?re ready|i'?ll be here)/.test(b);
  const userAskedReschedule =
    /(another time|reschedule|come back to this|need a break|is now a bad time|i'?m tired|right now isn'?t|do this later|do this another)/.test(u);
  if (botSaidReschedule || userAskedReschedule) {
    if (/totally understand|no worries|sounds good|absolutely/.test(b)) {
      return "reschedule";
    }
  }

  // A wrap phrase must be an *unambiguous* sign-off. Phrases like "thanks for
  // taking the time" or "thanks for chatting" were removed: the bot says them
  // mid-interview ("thanks for taking the time to explain that") and would
  // falsely end the conversation.
  const wrapPhrase =
    /(wrap up|wrapping up|i'?ll end here|best of luck out there|wishing you the best|wrap things up|so i'?ll wrap|let'?s wrap)/.test(b) ||
    /(recruiter will (review|be in touch|follow up)|recruiter (will|may) reach out)/.test(b) ||
    /(have a (great|wonderful|nice) day)/.test(b) ||
    /(we[' ]?ll be in touch|we will be in touch)/.test(b) ||
    /(all the best in your (job search|career))/.test(b);

  if (!wrapPhrase) return undefined;

  // Only treat as not_interested if the candidate said something *explicit*.
  // Soft signals like "tired" or "another time" route to reschedule above,
  // so they won't reach this branch.
  if (/\b(not interested|don'?t want this|changed my mind|isn'?t for me|lol no|no thanks)\b/.test(u)) {
    return "not_interested";
  }
  if (
    /(can only discuss|outside what i'?m here|focus.*role|on[- ]topic)/.test(b)
  ) {
    return "off_topic";
  }
  // Dealbreaker closings: the bot wrapped up because a must-have is missing or
  // a red flag surfaced. These map to the same reasons the end_interview tool
  // emits, so downstream scoring treats them consistently.
  if (
    /(not (quite )?(the|a) right fit|might not be (the|a) (right )?fit|isn'?t (the|a) (right )?(fit|match)|this (particular )?role (requires|calls for)|not (the|a) match for this role)/.test(b)
  ) {
    return "missing_must_have";
  }
  if (/(red flag|raises (a )?concern|serious concern|dealbreaker|can'?t move forward)/.test(b)) {
    return "red_flag_inferred";
  }
  return "completed";
}

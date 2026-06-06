/**
 * Build the recruiter's next-round invite to a candidate. Used by both
 * the real recruiter dashboard (mailto: handoff into their mail client)
 * and the public demo (preview modal that shows the same draft).
 *
 * Recruiter reviews and sends from their own email account — we never
 * see or send anything.
 */

type Input = {
  candidate: { name: string; email: string };
  roleTitle: string;
  recruiterFirstName?: string | null;
};

export type NextRoundDraft = {
  subject: string;
  body: string;
  mailto: string;
};

export function buildNextRoundDraft({
  candidate,
  roleTitle,
  recruiterFirstName,
}: Input): NextRoundDraft {
  const subject = `Next steps, ${roleTitle}`;
  const signer = recruiterFirstName?.trim() || "The hiring team";
  const body = [
    `Hi ${candidate.name.split(" ")[0]},`,
    "",
    `Thanks for taking the time to chat with PurpleHire about the ${roleTitle} role.`,
    "Based on the interview, we'd love to take this to the next step with our team.",
    "",
    "Could you share your availability for a follow-up conversation next week?",
    "",
    "Best,",
    signer,
  ].join("\n");

  const params = new URLSearchParams({ subject, body });
  // URLSearchParams uses + for spaces; mail clients prefer %20. Swap it.
  const query = params.toString().replace(/\+/g, "%20");
  const mailto = `mailto:${encodeURIComponent(candidate.email)}?${query}`;

  return { subject, body, mailto };
}

/** Back-compat alias for the existing callers that only need the mailto URL. */
export function buildNextRoundMailto(input: Input): string {
  return buildNextRoundDraft(input).mailto;
}

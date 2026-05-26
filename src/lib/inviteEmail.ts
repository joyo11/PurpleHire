/**
 * Build a `mailto:` href that opens the recruiter's mail client with a
 * pre-filled invite-to-next-round message. Recruiter reviews + edits +
 * sends from their own email account — we never see or send anything.
 */

type Input = {
  candidate: { name: string; email: string };
  roleTitle: string;
  recruiterFirstName?: string | null;
};

export function buildNextRoundMailto({
  candidate,
  roleTitle,
  recruiterFirstName,
}: Input): string {
  const subject = `Next steps — ${roleTitle}`;
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
  return `mailto:${encodeURIComponent(candidate.email)}?${query}`;
}

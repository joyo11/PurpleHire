import OpenAI from "openai";
import type { Recruiter } from "./db.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const SYSTEM = `You write short, human, one-shot cold emails for a solo developer reaching out to recruiters about an AI hiring tool called PurpleHire.

Rules:
- 3–5 sentences total in the body, no fluff.
- Plain text only, no markdown.
- First-name-only greeting.
- Open with a one-line *specific* reference using the hook the user provided. If no hook is provided, open with a clean role-relevant observation about their company or seniority.
- One sentence on what PurpleHire does, in their language (not buzzwords).
- One sentence on the ask: try it, share honest feedback. Free.
- Mention the link to the demo (provided in input) directly.
- Sign off with the sender's name on a new line, then optional title.
- End with the EXACT polite opt-out phrase: "If not useful, just delete this — no follow-ups."

Subject line:
- 4–7 words.
- Lowercase ok. No "Re:" trickery, no clickbait, no emoji.
- Should sound like a real one-off message a person would send.

Return STRICT JSON: { "subject": "<subject>", "body": "<full email body including greeting, paragraphs, opt-out line, and signature>" }`;

export type DraftInput = {
  recruiter: Recruiter;
  senderName: string;
  senderTitle: string;
  productUrl: string;
};

export type Draft = { subject: string; body: string };

export async function generateDraft({
  recruiter,
  senderName,
  senderTitle,
  productUrl,
}: DraftInput): Promise<Draft> {
  const userPrompt = `# Recruiter
Name: ${recruiter.name}
Company: ${recruiter.company}
${recruiter.title ? `Title: ${recruiter.title}\n` : ""}${recruiter.linkedin_url ? `LinkedIn: ${recruiter.linkedin_url}\n` : ""}${recruiter.hook ? `Hook (use this in the opener): ${recruiter.hook}\n` : "Hook: (none provided — improvise based on company)"}

# Sender
Name: ${senderName}
Title: ${senderTitle}

# Product
URL: ${productUrl}

What PurpleHire does (your reference — don't quote it verbatim):
PurpleHire is an AI recruiter. The recruiter pastes a job description and gets a shareable link. Candidates chat with the bot for ~10 minutes and the recruiter gets each one scored 1–10 with a one-line AI verdict. Replaces the form-fill / phone-screen loop. Demo lets anyone try both sides without signing up.

Draft the email.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(raw) as Draft;
  if (
    typeof parsed.subject !== "string" ||
    typeof parsed.body !== "string" ||
    !parsed.subject.trim() ||
    !parsed.body.trim()
  ) {
    throw new Error("Draft model returned malformed JSON.");
  }
  return parsed;
}

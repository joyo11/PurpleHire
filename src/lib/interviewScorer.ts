import OpenAI from "openai";
import { prisma } from "./prisma";
import type { InterviewPlan } from "./jdAnalyzer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

type Score = { score: number; verdict: string };

const SYSTEM = `You are an experienced hiring manager evaluating an AI-conducted interview transcript.

Given a job description, the interview plan the bot followed, and the full transcript, score the candidate from 1 to 10:
- 1-3: Clear no — missing must-haves, red flags hit, or interview ended early in a bad way.
- 4-6: Mixed signal — some skills present, some gaps; would need a human follow-up to decide.
- 7-8: Solid yes — covers most must-haves with credible answers, no red flags.
- 9-10: Strong candidate — clear must-have coverage, depth in their answers, no concerns.

Also produce a one-sentence verdict (max 25 words) the recruiter can scan, explaining the score.

Return STRICT JSON: { "score": <int 1-10>, "verdict": "<one sentence>" }`;

export async function scoreInterview(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      candidate: { include: { role: true } },
    },
  });

  if (!conversation?.candidate?.role) return;

  const role = conversation.candidate.role;
  let plan: InterviewPlan | null = null;
  try {
    plan = JSON.parse(role.interviewPlan) as InterviewPlan;
  } catch {
    plan = null;
  }

  const transcript = conversation.messages
    .map(
      (m) =>
        `${m.role === "assistant" ? "Interviewer (Ava)" : "Candidate"}: ${m.content}`,
    )
    .join("\n\n");

  const userPrompt = `# Role
${role.title}

# Job description
${role.jdText}

${
  plan
    ? `# Interview plan the bot followed
Must-haves: ${plan.must_haves.join(", ") || "(none)"}
Skills probed: ${plan.skills_to_probe.join(", ") || "(none)"}
Red flags watched: ${plan.red_flags.join(", ") || "(none)"}
`
    : ""
}
# Transcript
${transcript}

# End reason
${conversation.endReason ?? "unknown"}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: Score | null = null;
  try {
    const obj = JSON.parse(raw) as Score;
    if (
      typeof obj.score === "number" &&
      obj.score >= 1 &&
      obj.score <= 10 &&
      typeof obj.verdict === "string"
    ) {
      parsed = obj;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) return;

  await prisma.candidate.update({
    where: { id: conversation.candidate.id },
    data: {
      score: parsed.score,
      verdict: parsed.verdict,
      scoredAt: new Date(),
    },
  });
}

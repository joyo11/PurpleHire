import OpenAI from "openai";
import { prisma } from "./prisma";
import type { InterviewPlan } from "./jdAnalyzer";
import { withLlmSpan } from "@/lib/observability";
import { MODELS } from "@/lib/models";
import {
  SCORING_SYSTEM,
  buildScoringUserPrompt,
  type TranscriptMessage,
} from "@/lib/scoringPrompt";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

export type ScoreResult = { score: number; verdict: string };

/** Pure scoring — no DB. Reusable by both real interviews and the demo flow. */
export async function scoreTranscript({
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
}): Promise<ScoreResult | null> {
  const userPrompt = buildScoringUserPrompt({
    roleTitle,
    jdText,
    plan,
    messages,
    endReason,
  });

  const completion = await withLlmSpan(
    "interview_score",
    MODELS.scoring,
    () =>
      openai.chat.completions.create({
        model: MODELS.scoring,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SCORING_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    (c) => ({
      promptTokens: c.usage?.prompt_tokens,
      completionTokens: c.usage?.completion_tokens,
    }),
  );

  const raw = completion.choices[0]?.message?.content ?? "";
  try {
    const obj = JSON.parse(raw) as ScoreResult;
    if (
      typeof obj.score === "number" &&
      obj.score >= 1 &&
      obj.score <= 10 &&
      typeof obj.verdict === "string"
    ) {
      return obj;
    }
  } catch {
    // fall through
  }
  return null;
}

/** DB-backed scoring used by /api/chat when an interview completes. */
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

  const result = await scoreTranscript({
    roleTitle: role.title,
    jdText: role.jdText,
    plan,
    messages: conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    endReason: conversation.endReason,
  });
  if (!result) return;

  await prisma.candidate.update({
    where: { id: conversation.candidate.id },
    data: {
      score: result.score,
      verdict: result.verdict,
      scoredAt: new Date(),
    },
  });
}

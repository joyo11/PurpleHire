import type { NextApiRequest, NextApiResponse } from "next";
import { runInterviewTurn } from "@/services/openaiService";
import {
  buildInterviewSystemPrompt,
  type PromptCompetency,
} from "@/lib/interviewPrompt";
import { getSampleRole } from "@/lib/sampleRoles";
import { TARGET_MIN, TARGET_MAX, MAX_QUESTIONS } from "@/lib/interviewMachine";

/**
 * Ephemeral chat endpoint for the public demo. No DB writes — the browser sends
 * the full history each turn. Stateless, so it can't run the full coverage
 * tracker; it uses a lightweight question count to decide when to wrap, and the
 * AI (never the candidate) still owns completion.
 */

type ClientMessage = { role: "user" | "assistant"; content: string };
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LEN = 4000;
const MAX_NAME_LEN = 80;
const DEMO_MIN = 4; // demo wraps a little sooner than a real interview

function demoCompetencies(mustHaves: string[]): PromptCompetency[] {
  const list = (mustHaves ?? [])
    .slice(0, 6)
    .map((label, i) => ({ id: String(i), label }));
  return list.length ? list : [{ id: "0", label: "General fit for the role" }];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { roleKey, candidateName, messages, action } = req.body as {
    roleKey?: string;
    candidateName?: string;
    messages?: ClientMessage[];
    action?: "skip" | "leave";
  };

  if (!roleKey || !candidateName?.trim() || !Array.isArray(messages)) {
    return res
      .status(400)
      .json({ error: "roleKey, candidateName, messages required" });
  }
  if (candidateName.length > MAX_NAME_LEN) {
    return res.status(400).json({ error: "name too long" });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: "demo conversation too long" });
  }
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") {
      return res.status(400).json({ error: "bad message role" });
    }
    if (typeof m.content !== "string" || m.content.length > MAX_MESSAGE_LEN) {
      return res.status(400).json({ error: "bad message content" });
    }
  }

  const sample = getSampleRole(roleKey);
  if (!sample) {
    return res.status(404).json({ error: "Unknown demo role" });
  }

  const name = candidateName.trim().slice(0, MAX_NAME_LEN);

  if (action === "leave") {
    return res.status(200).json({
      message: {
        role: "assistant",
        content: `Thanks for trying the demo, ${name}. In a real interview this would be saved as incomplete for the hiring team.`,
      },
      status: "left_early",
    });
  }

  const comps = demoCompetencies(sample.plan.must_haves);
  const questionsAsked = messages.filter((m) => m.role === "assistant").length;

  const systemPrompt = buildInterviewSystemPrompt({
    roleTitle: sample.title,
    candidateName: name,
    jdText: sample.jdText,
    plan: sample.plan,
    competencies: comps,
    phase: questionsAsked === 0 ? "welcome" : "active",
    readiness: questionsAsked === 0 ? undefined : undefined,
    neededIds: comps.map((c) => c.id),
    questionsAsked,
    targetMin: TARGET_MIN,
    targetMax: TARGET_MAX,
    maxQuestions: MAX_QUESTIONS,
  });

  const history = messages.map((m, i) => ({
    id: `demo-${i}`,
    content: m.content,
    role: m.role,
    conversationId: "demo",
    createdAt: new Date(),
  }));

  const turn = await runInterviewTurn(history, systemPrompt);

  // AI-owned completion (approximated statelessly for the demo).
  const complete =
    questionsAsked >= MAX_QUESTIONS ||
    (turn.recommend === "wrap_up" && questionsAsked >= DEMO_MIN);

  if (complete) {
    return res.status(200).json({
      message: {
        role: "assistant",
        content: `That's everything I needed, ${name}. Thanks for trying the demo, your responses would now go to the hiring team.`,
      },
      endInterviewReason: "completed",
    });
  }

  return res.status(200).json({
    message: turn.reply ? { role: "assistant", content: turn.reply } : null,
    status: "in_progress",
  });
}

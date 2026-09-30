import type { NextApiRequest, NextApiResponse } from "next";
import { generateResponse } from "@/services/openaiService";
import { buildInterviewSystemPrompt } from "@/lib/interviewPrompt";
import { getSampleRole } from "@/lib/sampleRoles";
import { classifyCandidateIntent } from "@/lib/inferEndFromText";

// Copy for the clarification turn — mirrors /api/chat so the demo behaves
// identically (an ambiguous "leaving" signal never ends the interview).
const CLARIFY_MESSAGE =
  "No problem. We can keep going in text, skip this question, or wrap up here — what works?";

// End authority is server-owned: bot prose never terminates. Only a genuine
// completion or a safety red flag the model proposes may end a turn.
function gateProposedEnd(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  if (reason === "completed") return reason;
  if (reason.startsWith("red_flag_")) return reason;
  return undefined;
}

/**
 * Ephemeral chat endpoint for the public demo. No DB writes — the
 * caller (browser) sends the full message history every turn and we
 * stream a single new bot response back. Anyone hitting the URL is
 * allowed, but the only roles that work are the hardcoded sample
 * keys, and we cap history length to bound cost.
 */

type ClientMessage = { role: "user" | "assistant"; content: string };
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LEN = 4000;
const MAX_NAME_LEN = 80;

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
    action?: "continue" | "skip" | "end";
  };

  if (!roleKey || !candidateName?.trim() || !Array.isArray(messages)) {
    return res.status(400).json({ error: "roleKey, candidateName, messages required" });
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

  const systemPrompt = buildInterviewSystemPrompt({
    roleTitle: sample.title,
    candidateName: candidateName.trim().slice(0, MAX_NAME_LEN),
    jdText: sample.jdText,
    plan: sample.plan,
  });

  const name = candidateName.trim().slice(0, MAX_NAME_LEN);
  const closing = `Thanks for taking the time today, ${name}. Take care!`;

  // Server-authoritative ending (mirrors /api/chat). The End-interview chip is
  // a confirmed, explicit end. A typed message is classified: an explicit
  // whole-interview end is honored; an ambiguous "leaving" signal NEVER ends
  // and routes to a clarification turn; everything else continues normally.
  if (action === "end") {
    return res.status(200).json({
      message: { role: "assistant", content: closing },
      endInterviewReason: "candidate_ended",
    });
  }
  if (!action) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const intent = classifyCandidateIntent(lastUser?.content ?? "");
    if (intent === "explicit_end") {
      return res.status(200).json({
        message: { role: "assistant", content: closing },
        endInterviewReason: "candidate_ended",
      });
    }
    if (intent === "leave") {
      return res.status(200).json({
        message: { role: "assistant", content: CLARIFY_MESSAGE },
        status: "clarifying",
      });
    }
  }

  const history = messages.map((m, i) => ({
    id: `demo-${i}`,
    content: m.content,
    role: m.role,
    conversationId: "demo",
    createdAt: new Date(),
  }));

  const llm = await generateResponse(history, systemPrompt);

  // Gate the model's proposed end: bot prose never terminates. Only a genuine
  // completion or a safety red flag may end the demo.
  const endInterviewReason = gateProposedEnd(llm.endInterviewReason);

  return res.status(200).json({
    message: llm.text
      ? { role: "assistant", content: llm.text }
      : null,
    endInterviewReason,
  });
}

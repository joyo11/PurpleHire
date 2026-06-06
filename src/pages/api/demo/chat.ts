import type { NextApiRequest, NextApiResponse } from "next";
import { generateResponse } from "@/services/openaiService";
import { buildInterviewSystemPrompt } from "@/lib/interviewPrompt";
import { getSampleRole } from "@/lib/sampleRoles";
import { inferEndFromText } from "@/lib/inferEndFromText";

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

  const { roleKey, candidateName, messages } = req.body as {
    roleKey?: string;
    candidateName?: string;
    messages?: ClientMessage[];
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

  const history = messages.map((m, i) => ({
    id: `demo-${i}`,
    content: m.content,
    role: m.role,
    conversationId: "demo",
    createdAt: new Date(),
  }));

  const llm = await generateResponse(history, systemPrompt);

  // Safety net: if the LLM wrote an obvious closing line but forgot to
  // fire the end_interview tool, infer the reason from the candidate's
  // latest message and end on our side. Mirrors /api/chat behavior so
  // the demo flow can't leak past a goodbye.
  let endInterviewReason = llm.endInterviewReason;
  if (!endInterviewReason && llm.text) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    endInterviewReason = inferEndFromText(llm.text, lastUser?.content ?? "");
  }

  return res.status(200).json({
    message: llm.text
      ? { role: "assistant", content: llm.text }
      : null,
    endInterviewReason,
  });
}

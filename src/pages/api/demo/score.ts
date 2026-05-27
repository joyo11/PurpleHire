import type { NextApiRequest, NextApiResponse } from "next";
import { getSampleRole } from "@/lib/sampleRoles";
import { scoreTranscript } from "@/lib/interviewScorer";

type ClientMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LEN = 4000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { roleKey, messages, endReason } = req.body as {
    roleKey?: string;
    messages?: ClientMessage[];
    endReason?: string;
  };

  if (!roleKey || !Array.isArray(messages)) {
    return res.status(400).json({ error: "roleKey + messages required" });
  }
  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: "bad transcript length" });
  }
  for (const m of messages) {
    if (
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" ||
      m.content.length > MAX_MESSAGE_LEN
    ) {
      return res.status(400).json({ error: "bad message" });
    }
  }

  const sample = getSampleRole(roleKey);
  if (!sample) {
    return res.status(404).json({ error: "Unknown demo role" });
  }

  const result = await scoreTranscript({
    roleTitle: sample.title,
    jdText: sample.jdText,
    plan: sample.plan,
    messages,
    endReason: endReason ?? null,
  });

  if (!result) {
    return res.status(502).json({ error: "Could not score the transcript." });
  }

  return res.status(200).json(result);
}

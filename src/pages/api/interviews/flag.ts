import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

// Best-effort proctoring signal: the candidate left the interview tab.
// Increments Conversation.tabSwitches so the recruiter can see it later.
// No auth (candidate-side); never errors the candidate's session.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const conversationId = (req.body as { conversationId?: string })
    ?.conversationId;
  if (typeof conversationId !== "string" || !conversationId) {
    return res.status(400).json({ error: "conversationId required" });
  }
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { tabSwitches: { increment: 1 } },
    });
  } catch {
    // conversation may not exist (e.g. demo) — ignore, this is best-effort.
  }
  return res.status(204).end();
}

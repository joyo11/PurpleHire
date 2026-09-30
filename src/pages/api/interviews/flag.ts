import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

// Best-effort proctoring signals (candidate-side, no auth, never errors the
// candidate's session):
//   type "tab"   -> the candidate left the interview tab (tabSwitches++)
//   type "paste" -> a large paste into the answer box (pasteCount++)
// Both feed the recruiter's AI-assist risk hint. Defaults to "tab" for
// backwards compatibility with the original tab-only client.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = (req.body ?? {}) as { conversationId?: string; type?: string };
  const conversationId = body.conversationId;
  if (typeof conversationId !== "string" || !conversationId) {
    return res.status(400).json({ error: "conversationId required" });
  }
  const field = body.type === "paste" ? "pasteCount" : "tabSwitches";
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { [field]: { increment: 1 } },
    });
  } catch {
    // conversation may not exist (e.g. demo) — ignore, this is best-effort.
  }
  return res.status(204).end();
}

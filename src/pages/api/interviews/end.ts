import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { scoreInterview } from "@/lib/interviewScorer";

/**
 * Public endpoint the candidate's browser can hit to end their own
 * interview (typically because they've been idle for too long). No
 * recruiter auth — the caller is the candidate themselves, so we only
 * trust the conversationId they were given when the interview started.
 *
 * Idempotent: hitting this on an already-completed conversation is a
 * no-op.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { conversationId, reason } = req.body as {
    conversationId?: string;
    reason?: string;
  };

  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required" });
  }

  const safeReason = (reason && /^[a-z_]{1,32}$/i.test(reason))
    ? reason
    : "inactive";

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, status: true },
  });
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  if (conv.status === "completed") {
    return res.status(200).json({ status: "completed", endReason: null });
  }

  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      status: "completed",
      endReason: safeReason,
      updatedAt: new Date(),
    },
  });

  // Best-effort scoring — even partial transcripts get a score so the
  // recruiter sees something useful instead of a blank candidate row.
  try {
    await scoreInterview(conv.id);
  } catch (err) {
    console.error("scoreInterview failed for ended conversation", err);
  }

  return res.status(200).json({ status: "completed", endReason: safeReason });
}

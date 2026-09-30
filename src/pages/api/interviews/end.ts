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

  const { conversationId } = req.body as {
    conversationId?: string;
  };

  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required" });
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, status: true },
  });
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  // Terminal states are left untouched (idempotent).
  if (conv.status === "completed" || conv.status === "left_early") {
    return res.status(200).json({ status: conv.status });
  }

  // Idle/interrupted -> DISCONNECTED, which is resumable. We do NOT mark it
  // completed: a refresh, network blip, or closed tab must not destroy an
  // interview. If the candidate returns, /api/chat resumes it. `reason` from an
  // explicit leave is handled in /api/chat (status left_early), not here.
  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      status: "disconnected",
      endReason: "disconnected",
      updatedAt: new Date(),
    },
  });

  // Best-effort provisional scoring so a recruiter sees partial evidence (marked
  // incomplete). If the candidate resumes and finishes, it is re-scored.
  try {
    await scoreInterview(conv.id);
  } catch (err) {
    console.error("scoreInterview failed for disconnected conversation", err);
  }

  return res.status(200).json({ status: "disconnected", endReason: "disconnected" });
}

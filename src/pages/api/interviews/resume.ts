import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Resume-on-reload. The candidate's browser stored its conversationId in
 * localStorage when the interview started; on reload it asks here whether that
 * conversation can be resumed, and if so gets the full transcript back so the
 * candidate continues exactly where they left off (no duplicated question, no
 * double counting, since all state lives server-side in Conversation.metadata).
 *
 * No recruiter auth: the caller is the candidate, trusted only via the opaque
 * conversationId they were given. Terminal interviews are NOT resumable.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { conversationId } = req.body as { conversationId?: string };
  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required" });
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      candidate: { include: { role: true } },
    },
  });

  if (!conv || !conv.candidate?.role) {
    return res.status(200).json({ resumable: false });
  }

  // Completed or explicitly-left interviews cannot be resumed.
  if (conv.status === "completed" || conv.status === "left_early") {
    return res.status(200).json({ resumable: false, status: conv.status });
  }

  let state: "welcome" | "active" = "active";
  try {
    const meta = JSON.parse(conv.metadata || "{}") as { state?: string };
    if (meta.state === "welcome") state = "welcome";
  } catch {
    // default to active
  }

  return res.status(200).json({
    resumable: true,
    status: conv.status, // "in_progress" | "disconnected"
    state,
    mode: conv.mode === "voice" ? "voice" : "chat",
    candidateName: conv.candidate.name,
    roleTitle: conv.candidate.role.title,
    messages: conv.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });
}

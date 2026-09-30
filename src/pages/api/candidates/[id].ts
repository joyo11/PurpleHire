import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return res.status(401).json({ error: "Not signed in" });

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Missing candidate id" });
  }

  if (req.method !== "DELETE" && req.method !== "PATCH") {
    res.setHeader("Allow", "DELETE, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    select: {
      id: true,
      role: { select: { recruiterId: true } },
      conversations: { select: { id: true } },
    },
  });
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });
  if (candidate.role.recruiterId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // PATCH: toggle the "reviewed" flag for the recruiter.
  if (req.method === "PATCH") {
    const reviewed = (req.body?.reviewed ?? true) === true;
    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data: { reviewedAt: reviewed ? new Date() : null },
      select: { reviewedAt: true },
    });
    return res.status(200).json({
      reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
    });
  }

  // DELETE: remove the candidate + its conversations/messages.
  const conversationIds = candidate.conversations.map((c) => c.id);
  await prisma.$transaction(async (tx) => {
    if (conversationIds.length) {
      await tx.message.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });
      await tx.conversation.deleteMany({
        where: { id: { in: conversationIds } },
      });
    }
    await tx.candidate.delete({ where: { id: candidate.id } });
  });

  return res.status(204).end();
}

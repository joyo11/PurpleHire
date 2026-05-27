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
    return res.status(400).json({ error: "Missing role id" });
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const role = await prisma.role.findUnique({
    where: { id },
    select: {
      id: true,
      recruiterId: true,
      candidates: { select: { id: true, conversations: { select: { id: true } } } },
    },
  });
  if (!role) return res.status(404).json({ error: "Role not found" });
  if (role.recruiterId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Manual cascade: messages don't auto-delete with their conversations,
  // and we want to clean up everything related to this role.
  const conversationIds = role.candidates.flatMap((c) =>
    c.conversations.map((cv) => cv.id),
  );

  await prisma.$transaction(async (tx) => {
    if (conversationIds.length) {
      await tx.message.deleteMany({
        where: { conversationId: { in: conversationIds } },
      });
      await tx.conversation.deleteMany({
        where: { id: { in: conversationIds } },
      });
    }
    // Candidates cascade-delete via the role relation, so the role
    // delete handles them. But we delete candidates explicitly here
    // to be defensive about any orphan paths.
    const candidateIds = role.candidates.map((c) => c.id);
    if (candidateIds.length) {
      await tx.candidate.deleteMany({ where: { id: { in: candidateIds } } });
    }
    await tx.role.delete({ where: { id: role.id } });
  });

  return res.status(204).end();
}

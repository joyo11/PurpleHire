import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DECISIONS = ["shortlisted", "rejected", "maybe"] as const;
type Decision = (typeof DECISIONS)[number];

function isDecision(v: unknown): v is Decision {
  return typeof v === "string" && (DECISIONS as readonly string[]).includes(v);
}

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
    res.setHeader("Allow", "PATCH, DELETE");
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

  // PATCH: update the "reviewed" flag and/or the recruiter's decision.
  if (req.method === "PATCH") {
    const body = (req.body ?? {}) as {
      reviewed?: unknown;
      decision?: unknown;
    };
    const data: { reviewedAt?: Date | null; decision?: Decision | null } = {};

    if ("reviewed" in body) {
      if (typeof body.reviewed !== "boolean") {
        return res.status(400).json({ error: "reviewed must be a boolean" });
      }
      data.reviewedAt = body.reviewed ? new Date() : null;
    }

    if ("decision" in body) {
      if (body.decision === null) {
        data.decision = null;
      } else if (isDecision(body.decision)) {
        data.decision = body.decision;
      } else {
        return res.status(400).json({
          error: "decision must be shortlisted, rejected, maybe, or null",
        });
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data,
      select: { id: true, decision: true, reviewedAt: true },
    });

    return res.status(200).json({
      id: updated.id,
      decision: updated.decision,
      reviewed: updated.reviewedAt !== null,
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

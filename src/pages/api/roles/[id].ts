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

  if (req.method === "PATCH") {
    return handlePatch(req, res, id, userId);
  }
  if (req.method === "DELETE") {
    return handleDelete(res, id, userId);
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
  userId: string,
) {
  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true, recruiterId: true },
  });
  if (!role) return res.status(404).json({ error: "Role not found" });
  if (role.recruiterId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const data: {
    title?: string;
    jdText?: string;
    interviewPlan?: string;
    expiresAt?: Date | null;
    durationMin?: number | null;
    allowRetries?: boolean;
  } = {};

  if ("title" in body && body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return res.status(400).json({ error: "Title must be a non-empty string." });
    }
    if (body.title.length > 200) {
      return res.status(400).json({ error: "Title is too long (max 200 characters)." });
    }
    data.title = body.title.trim();
  }

  if ("jdText" in body && body.jdText !== undefined) {
    if (typeof body.jdText !== "string" || !body.jdText.trim()) {
      return res.status(400).json({ error: "JD text must be a non-empty string." });
    }
    if (body.jdText.length > 20000) {
      return res.status(400).json({ error: "JD is too long (max 20k characters)." });
    }
    data.jdText = body.jdText.trim();
  }

  if ("interviewPlan" in body && body.interviewPlan !== undefined) {
    const plan = body.interviewPlan;
    if (typeof plan === "string") {
      try {
        const parsed = JSON.parse(plan);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
      } catch {
        return res
          .status(400)
          .json({ error: "interviewPlan must be a valid JSON object." });
      }
      if (plan.length > 40000) {
        return res.status(400).json({ error: "Interview plan is too large." });
      }
      data.interviewPlan = plan;
    } else if (typeof plan === "object" && !Array.isArray(plan)) {
      const serialized = JSON.stringify(plan);
      if (serialized.length > 40000) {
        return res.status(400).json({ error: "Interview plan is too large." });
      }
      data.interviewPlan = serialized;
    } else {
      return res
        .status(400)
        .json({ error: "interviewPlan must be an object or a JSON string." });
    }
  }

  if ("expiresAt" in body && body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === "") {
      data.expiresAt = null;
    } else if (typeof body.expiresAt === "string" || typeof body.expiresAt === "number") {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "expiresAt must be a valid date." });
      }
      data.expiresAt = d;
    } else {
      return res.status(400).json({ error: "expiresAt must be a date or null." });
    }
  }

  if ("durationMin" in body && body.durationMin !== undefined) {
    if (body.durationMin === null) {
      data.durationMin = null;
    } else if (
      typeof body.durationMin === "number" &&
      Number.isInteger(body.durationMin) &&
      body.durationMin > 0 &&
      body.durationMin <= 600
    ) {
      data.durationMin = body.durationMin;
    } else {
      return res
        .status(400)
        .json({ error: "durationMin must be a positive integer (max 600) or null." });
    }
  }

  if ("allowRetries" in body && body.allowRetries !== undefined) {
    if (typeof body.allowRetries !== "boolean") {
      return res.status(400).json({ error: "allowRetries must be a boolean." });
    }
    data.allowRetries = body.allowRetries;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No valid fields to update." });
  }

  const updated = await prisma.role.update({
    where: { id },
    data,
  });

  return res.status(200).json({ role: updated });
}

async function handleDelete(
  res: NextApiResponse,
  id: string,
  userId: string,
) {
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

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { checkInterviewQuota } from "@/lib/limits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slug, name, email } = req.body as {
    slug?: string;
    name?: string;
    email?: string;
  };

  if (!slug || !name?.trim() || !email?.trim()) {
    return res
      .status(400)
      .json({ error: "Missing slug, name, or email." });
  }

  if (!EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "That doesn't look like a valid email." });
  }

  const role = await prisma.role.findUnique({
    where: { slug },
    select: { id: true, title: true, recruiterId: true },
  });

  if (!role) {
    return res.status(404).json({ error: "Interview link not found." });
  }

  // Free-plan quota gate. We block a NEW interview from starting if the
  // recruiter is on the free plan and has used all 10 of their monthly
  // completed interviews. In-progress interviews are unaffected.
  const gate = await checkInterviewQuota({ recruiterId: role.recruiterId });
  if (!gate.allowed) {
    return res.status(402).json({
      error: gate.reason ?? "Quota exceeded.",
      code: "free_plan_limit",
      plan: gate.plan,
      monthlyInterviews: gate.monthlyInterviews,
      monthlyLimit: gate.monthlyLimit,
    });
  }

  const candidate = await prisma.candidate.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      roleId: role.id,
    },
    select: { id: true },
  });

  const conversation = await prisma.conversation.create({
    data: {
      status: "in_progress",
      metadata: JSON.stringify({ startedAt: Date.now() }),
      candidateId: candidate.id,
    },
    select: { id: true },
  });

  return res.status(201).json({
    conversationId: conversation.id,
    candidateId: candidate.id,
    roleTitle: role.title,
  });
}

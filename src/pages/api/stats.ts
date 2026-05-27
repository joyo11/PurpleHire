import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Admin-only usage counters. Gated by the ADMIN_EMAIL env var — the
 * caller must be signed in with the recruiter account whose email
 * matches. Anything else returns 403 with no info.
 */

let cache: { at: number; data: ReturnType<typeof shape> | null } = {
  at: 0,
  data: null,
};
const TTL_MS = 60_000;

function shape(args: {
  recruiters: number;
  roles: number;
  candidates: number;
  completed: number;
  ongoing: number;
}) {
  return args;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const userEmail = session?.user?.email?.toLowerCase();
  if (!adminEmail || !userEmail || userEmail !== adminEmail) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) {
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).json(cache.data);
  }

  const [recruiters, roles, candidates, completed, ongoing] = await Promise.all(
    [
      prisma.user.count(),
      prisma.role.count(),
      prisma.candidate.count(),
      prisma.conversation.count({ where: { status: "completed" } }),
      prisma.conversation.count({ where: { status: "in_progress" } }),
    ],
  );

  const data = shape({ recruiters, roles, candidates, completed, ongoing });
  cache = { at: now, data };

  res.setHeader("Cache-Control", "private, max-age=60");
  return res.status(200).json(data);
}

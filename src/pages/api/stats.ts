import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Public usage counters. Aggregate, non-sensitive — used for the
 * recruiter dashboard's "this is what's happening across the product"
 * strip and for sanity-checking growth from outside.
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

  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=60");
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

  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).json(data);
}

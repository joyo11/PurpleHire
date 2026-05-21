import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeJd } from "@/lib/jdAnalyzer";

const SLUG_BYTES = 4;

function makeSlug() {
  return randomBytes(SLUG_BYTES).toString("hex");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not signed in" });
  }

  if (req.method === "GET") {
    const roles = await prisma.role.findMany({
      where: { recruiterId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        createdAt: true,
      },
    });
    return res.status(200).json({ roles });
  }

  if (req.method === "POST") {
    const { title, jdText } = req.body as {
      title?: string;
      jdText?: string;
    };

    if (!title?.trim() || !jdText?.trim()) {
      return res
        .status(400)
        .json({ error: "Both a role title and JD text are required." });
    }
    if (jdText.length > 20000) {
      return res
        .status(400)
        .json({ error: "JD is too long (max 20k characters)." });
    }

    let analysis;
    try {
      analysis = await analyzeJd(title.trim(), jdText.trim());
    } catch (err) {
      console.error("JD analyzer failed", err);
      return res
        .status(502)
        .json({ error: "Could not analyze the JD right now. Try again." });
    }

    if (!analysis.is_jd) {
      return res.status(400).json({
        error: `That doesn't look like a job description — ${analysis.reason}`,
      });
    }

    let slug = makeSlug();
    for (let i = 0; i < 4; i++) {
      const taken = await prisma.role.findUnique({ where: { slug } });
      if (!taken) break;
      slug = makeSlug();
    }

    const role = await prisma.role.create({
      data: {
        slug,
        title: title.trim(),
        jdText: jdText.trim(),
        interviewPlan: JSON.stringify(analysis.plan),
        recruiterId: userId,
      },
      select: { id: true, slug: true, title: true, createdAt: true },
    });

    return res.status(201).json({
      role,
      confidence: analysis.confidence,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

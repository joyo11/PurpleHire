import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeJd, type InterviewPlan } from "@/lib/jdAnalyzer";

const SLUG_BYTES = 4;

function makeSlug() {
  return randomBytes(SLUG_BYTES).toString("hex");
}

/** Keep only clean, non-empty, deduped strings from an untrusted array. */
function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Normalize a recruiter-edited plan into a stored plan that is a strict
 * superset of InterviewPlan. skills_to_probe is synced to the edited
 * competencies so the interviewer prompt and scorer probe what the recruiter
 * actually chose.
 */
function normalizeProvidedPlan(
  provided: Record<string, unknown>,
): InterviewPlan & {
  competencies: string[];
  questions: string[];
  estimated_minutes: number;
} {
  const competencies = cleanStrings(
    provided.competencies ?? provided.skills_to_probe,
  );
  const questions = cleanStrings(provided.questions);
  const rawMinutes = provided.estimated_minutes;
  const estimated_minutes =
    typeof rawMinutes === "number" && Number.isFinite(rawMinutes)
      ? Math.min(180, Math.max(1, Math.round(rawMinutes)))
      : 8 + questions.length * 4;
  return {
    summary: typeof provided.summary === "string" ? provided.summary : "",
    must_haves: cleanStrings(provided.must_haves),
    nice_to_haves: cleanStrings(provided.nice_to_haves),
    skills_to_probe: competencies,
    red_flags: cleanStrings(provided.red_flags),
    competencies,
    questions,
    estimated_minutes,
  };
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
    const {
      title,
      jdText,
      interviewPlan: providedPlan,
      expiresAt,
      durationMin,
      allowRetries,
    } = req.body as {
      title?: string;
      jdText?: string;
      interviewPlan?: Record<string, unknown> | null;
      expiresAt?: string | null;
      durationMin?: number | null;
      allowRetries?: boolean;
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

    // Launch options (all optional, backward compatible).
    let expiresAtDate: Date | null = null;
    if (typeof expiresAt === "string" && expiresAt.trim()) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) {
        return res
          .status(400)
          .json({ error: "Expiration date is not a valid date." });
      }
      expiresAtDate = d;
    }

    let durationMinValue: number | null = null;
    if (durationMin != null) {
      const n = Math.round(Number(durationMin));
      if (!Number.isFinite(n) || n < 1 || n > 180) {
        return res
          .status(400)
          .json({ error: "Interview duration must be between 1 and 180 minutes." });
      }
      durationMinValue = n;
    }

    const allowRetriesValue = allowRetries === true;

    // Use the recruiter's edited plan when provided; otherwise analyze now.
    // This keeps the original single-step create behavior working.
    let planToStore: Record<string, unknown>;
    let confidence: "high" | "medium" | "low" | null = null;

    if (providedPlan && typeof providedPlan === "object") {
      planToStore = normalizeProvidedPlan(providedPlan);
    } else {
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
          error: `That doesn't look like a job description, ${analysis.reason}`,
        });
      }
      planToStore = analysis.plan as unknown as Record<string, unknown>;
      confidence = analysis.confidence;
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
        interviewPlan: JSON.stringify(planToStore),
        expiresAt: expiresAtDate,
        durationMin: durationMinValue,
        allowRetries: allowRetriesValue,
        recruiterId: userId,
      },
      select: { id: true, slug: true, title: true, createdAt: true },
    });

    return res.status(201).json({
      role,
      confidence,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

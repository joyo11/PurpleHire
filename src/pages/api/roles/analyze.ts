import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { analyzeJd, type InterviewPlan } from "@/lib/jdAnalyzer";

/**
 * Recruiter-facing draft plan. It is a strict SUPERSET of InterviewPlan so
 * that everything persisted on Role.interviewPlan still parses as an
 * InterviewPlan for the interviewer prompt and the scorer (they only read the
 * InterviewPlan fields). The extra fields (competencies, questions,
 * estimated_minutes) drive the editable step-2 UI.
 */
export type InterviewPlanDraft = InterviewPlan & {
  competencies: string[];
  questions: string[];
  estimated_minutes: number;
};

/** Coerce a possibly-missing/malformed field into a string array. The analyzer
 *  casts the LLM response without validation, so any plan array may be absent;
 *  never let that crash this endpoint. */
function arr(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Synthesize a concise, editable starter question set from the analysis. */
function buildQuestions(plan: InterviewPlan): string[] {
  const questions: string[] = [];
  for (const mh of arr(plan.must_haves).slice(0, 4)) {
    questions.push(`Walk me through your hands-on experience with ${mh}.`);
  }
  for (const skill of arr(plan.skills_to_probe).slice(0, 4)) {
    questions.push(`Tell me about a time you worked on ${skill}.`);
  }
  if (questions.length === 0) {
    questions.push("Tell me about your most relevant experience for this role.");
  }
  return dedupe(questions).slice(0, 8);
}

/** Rough interview length: a warm-up plus time per question, clamped. */
function estimateMinutes(questionCount: number): number {
  const est = 8 + questionCount * 4;
  return Math.min(45, Math.max(10, est));
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

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, jdText } = req.body as { title?: string; jdText?: string };

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
      error: `That doesn't look like a job description, ${analysis.reason}`,
    });
  }

  const base = analysis.plan ?? ({} as InterviewPlan);
  const competencies = dedupe(arr(base.skills_to_probe));
  const questions = buildQuestions(base);

  const plan: InterviewPlanDraft = {
    summary: typeof base.summary === "string" ? base.summary : "",
    must_haves: dedupe(arr(base.must_haves)),
    nice_to_haves: dedupe(arr(base.nice_to_haves)),
    skills_to_probe: competencies,
    red_flags: dedupe(arr(base.red_flags)),
    competencies,
    questions,
    estimated_minutes: estimateMinutes(questions.length),
  };

  return res.status(200).json({ plan, confidence: analysis.confidence });
}

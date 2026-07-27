import OpenAI from "openai";
import { withLlmSpan } from "@/lib/observability";
import { MODELS } from "@/lib/models";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

export type InterviewPlan = {
  must_haves: string[];
  nice_to_haves: string[];
  skills_to_probe: string[];
  red_flags: string[];
  summary: string;
};

export type JdAnalysis =
  | { is_jd: true; confidence: "high" | "medium" | "low"; plan: InterviewPlan }
  | { is_jd: false; reason: string };

const SYSTEM = `You analyze text submitted by a recruiter who is creating an AI-driven candidate interview.

Your job: decide whether the text is a real job description (JD) and, if so, extract a structured plan an interview bot will use to probe candidates.

Return STRICT JSON matching exactly one of these shapes:

If NOT a job description (e.g. a match report, a recipe, lyrics, an essay, marketing copy unrelated to hiring):
{ "is_jd": false, "reason": "<one short sentence explaining what it actually looks like>" }

If it IS a job description:
{
  "is_jd": true,
  "confidence": "high" | "medium" | "low",
  "plan": {
    "summary": "<one-sentence summary of the role>",
    "must_haves": ["<concrete required skill/experience>", ...],
    "nice_to_haves": ["<bonus skill/experience>", ...],
    "skills_to_probe": ["<specific technical or behavioral topic the interview should test>", ...],
    "red_flags": ["<dealbreaker signal the bot should watch for>", ...]
  }
}

Confidence guide:
- "high": JD has role title, responsibilities, requirements, and enough detail to interview against.
- "medium": JD-shaped but thin — missing one of the above.
- "low": Looks JD-ish but very short or vague — interview will be shallow.

Keep arrays concise (3-7 items each). No prose outside the JSON.`;

export async function analyzeJd(
  title: string,
  jdText: string,
): Promise<JdAnalysis> {
  const completion = await withLlmSpan(
    "jd_analysis",
    MODELS.jdAnalysis,
    () =>
      openai.chat.completions.create({
        model: MODELS.jdAnalysis,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Role title (provided separately): ${title}\n\n---\n\nJob description text:\n${jdText}`,
          },
        ],
      }),
    (c) => ({
      promptTokens: c.usage?.prompt_tokens,
      completionTokens: c.usage?.completion_tokens,
    }),
  );

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      is_jd: false,
      reason: "Could not analyze that text — please try again.",
    };
  }

  return parsed as JdAnalysis;
}

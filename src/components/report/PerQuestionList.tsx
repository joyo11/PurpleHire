import { EvaluationReport } from "@/lib/evaluationReport";

/** Fill color for the per-question score chip, matching the score bands. */
function chipClass(score: number): string {
  if (score >= 8) return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (score >= 6) return "bg-teal-500/15 text-teal-300 ring-teal-500/30";
  if (score >= 4) return "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30";
  return "bg-red-500/15 text-red-300 ring-red-500/30";
}

/** "Question-by-question": each interview question with its assessment and an
 *  optional per-question score. */
export default function PerQuestionList({
  report,
}: {
  report: EvaluationReport;
}) {
  if (report.perQuestion.length === 0) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h2 className="text-[14px] font-medium tracking-tight text-white/80">
        Question-by-question
      </h2>
      <ol className="mt-4 flex flex-col gap-4">
        {report.perQuestion.map((q, i) => (
          <li
            key={i}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 font-mono text-[12px] text-white/35">
                  {i + 1}.
                </span>
                <span className="text-[13px] font-medium leading-relaxed text-white/85">
                  {q.question}
                </span>
              </div>
              {typeof q.score === "number" && (
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums ring-1 ring-inset ${chipClass(q.score)}`}
                >
                  {q.score.toFixed(1)}/10
                </span>
              )}
            </div>
            <p className="mt-2 pl-[26px] text-[13px] leading-relaxed text-white/65">
              {q.assessment}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

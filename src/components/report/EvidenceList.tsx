import { EvaluationReport } from "@/lib/evaluationReport";

/** "Evidence from the interview": each observation, with an optional
 *  candidate quote rendered as a blockquote. */
export default function EvidenceList({
  report,
}: {
  report: EvaluationReport;
}) {
  if (report.evidence.length === 0) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h2 className="text-[14px] font-medium tracking-tight text-white/80">
        Evidence from the interview
      </h2>
      <ul className="mt-4 flex flex-col gap-4">
        {report.evidence.map((e, i) => (
          <li key={i} className="flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-purple-300/80" />
              <span className="text-[13px] leading-relaxed text-white/75">
                {e.point}
              </span>
            </div>
            {e.quote?.trim() && (
              <blockquote className="ml-4 border-l-2 border-purple-500/40 bg-white/[0.02] px-3 py-2 text-[12.5px] italic leading-relaxed text-white/60">
                &ldquo;{e.quote}&rdquo;
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

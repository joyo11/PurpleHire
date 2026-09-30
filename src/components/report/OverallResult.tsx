import {
  EvaluationReport,
  recommendationFromScore,
  tierFromScore,
} from "@/lib/evaluationReport";
import { Sparkle } from "@/components/ph";

/**
 * Top-of-report decision headline. Two modes:
 *  - Definitive: a numeric score exists and the interview was complete. Shows
 *    the score X.X/10, the tier label, the recommendation and the key signal.
 *  - Non-definitive: the interview was incomplete OR no score could be formed.
 *    Shows "Incomplete · Not enough evidence" (tierFromScore(null)) and the
 *    key signal, but NEVER a numeric tier, so a short interview is not read as
 *    a low score.
 */
export default function OverallResult({
  report,
  score,
}: {
  report: EvaluationReport;
  score: number | null;
}) {
  const nonDefinitive = report.incomplete || score === null;

  const tier = tierFromScore(nonDefinitive ? null : score);
  const recommendation = nonDefinitive
    ? "Not enough evidence"
    : recommendationFromScore(score);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-purple-500/[0.03] to-transparent p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <Sparkle className="h-3.5 w-3.5 text-purple-300" />
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-purple-300">
          Evaluation result
        </div>
        <div
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tier.cls}`}
        >
          {nonDefinitive ? (
            <span>Incomplete · Not enough evidence</span>
          ) : (
            <>
              {tier.label}
              <span className="font-mono">{(score as number).toFixed(1)}/10</span>
            </>
          )}
        </div>
      </div>

      {!nonDefinitive && (
        <div className="mb-3 flex items-baseline gap-3">
          <div className="font-mono text-[34px] font-semibold leading-none tracking-tight text-white sm:text-[40px]">
            {(score as number).toFixed(1)}
            <span className="text-[16px] font-normal text-white/40">/10</span>
          </div>
          <div className="text-[13px] font-medium text-white/70">
            {recommendation}
          </div>
        </div>
      )}

      {nonDefinitive && (
        <div className="mb-3 text-[13px] font-medium text-white/70">
          {recommendation}
        </div>
      )}

      <p className="text-[14px] leading-relaxed text-white/85 sm:text-[14.5px]">
        {report.keySignal?.trim() ? (
          report.keySignal
        ) : (
          <span className="italic text-white/55">
            No headline signal was recorded for this interview.
          </span>
        )}
      </p>
    </div>
  );
}

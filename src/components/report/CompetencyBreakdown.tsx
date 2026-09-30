import { EvaluationReport } from "@/lib/evaluationReport";
import ScoreExplainer from "@/components/ScoreExplainer";

/** Bar fill color by score band, matching the recruiter score explainer. */
function barClass(score: number): string {
  if (score >= 8) return "bg-emerald-400/70";
  if (score >= 6) return "bg-teal-400/70";
  if (score >= 4) return "bg-yellow-400/70";
  return "bg-red-400/70";
}

function CompetencyBar({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const assessed = score !== null;
  const pct = assessed ? Math.max(0, Math.min(100, (score / 10) * 100)) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 truncate text-[13px] text-white/70" title={label}>
        {label}
      </div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        {assessed && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${barClass(score)}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div className="w-20 shrink-0 text-right font-mono text-[12px] tabular-nums">
        {assessed ? (
          <span className="text-white/80">{score.toFixed(1)}/10</span>
        ) : (
          <span className="text-white/35">Not assessed</span>
        )}
      </div>
    </div>
  );
}

function titleCase(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * Competency breakdown: one labeled horizontal bar per competency, the
 * confidence + must-have coverage summary lines, and the folded-in
 * "How scoring works" explainer.
 */
export default function CompetencyBreakdown({
  report,
}: {
  report: EvaluationReport;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h2 className="text-[14px] font-medium tracking-tight text-white/80">
        Competency breakdown
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        {report.breakdown.length === 0 ? (
          <p className="text-[13px] text-white/50">
            No competencies were scored for this interview.
          </p>
        ) : (
          report.breakdown.map((c, i) => (
            <CompetencyBar key={`${c.key}-${i}`} label={c.label} score={c.score} />
          ))
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-[12.5px] text-white/55">
        <span>
          Confidence:{" "}
          <span className="font-medium text-white/80">
            {titleCase(report.confidence)}
          </span>{" "}
          · {report.competenciesAssessed}/{report.competenciesTotal} competencies
          assessed
        </span>
        <span>
          Must-have coverage:{" "}
          <span className="font-medium text-white/80">
            {report.mustHaveCovered}/{report.mustHaveTotal}
          </span>
        </span>
      </div>

      <div className="mt-4">
        <ScoreExplainer />
      </div>
    </section>
  );
}

import { EvaluationReport } from "@/lib/evaluationReport";

function Column({
  title,
  items,
  tone,
  emptyLabel,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
  emptyLabel: string;
}) {
  const dot =
    tone === "positive" ? "bg-emerald-400/80" : "bg-yellow-400/80";
  const heading =
    tone === "positive" ? "text-emerald-300" : "text-yellow-300";

  return (
    <div className="flex-1 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h3 className={`text-[13px] font-medium tracking-tight ${heading}`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] italic text-white/45">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
              />
              <span className="text-[13px] leading-relaxed text-white/75">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Side-by-side (stacked on mobile) strengths and concerns/gaps. */
export default function StrengthsConcerns({
  report,
}: {
  report: EvaluationReport;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Column
        title="Strengths"
        items={report.strengths}
        tone="positive"
        emptyLabel="No standout strengths were recorded."
      />
      <Column
        title="Concerns / gaps"
        items={report.concerns}
        tone="negative"
        emptyLabel="No concerns were flagged."
      />
    </div>
  );
}

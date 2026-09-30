"use client";

import { useState } from "react";

/**
 * Recruiter-facing explanation of the 1-10 AI score. Shown on the candidate /
 * results view (NOT the landing page). Answers the questions recruiters ask:
 * what the bands mean, how it's computed, and the honest caveat that it's a
 * screening signal rather than a hiring decision.
 */
const BANDS: { range: string; label: string; cls: string }[] = [
  {
    range: "8.0–10",
    label: "Strong fit: clear must-have coverage, real depth. Advance.",
    cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  {
    range: "6.0–7.9",
    label: "Solid, leaning yes: most must-haves covered, some thin spots.",
    cls: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  },
  {
    range: "4.0–5.9",
    label: "Mixed signal: some skills, some gaps. Worth a human look.",
    cls: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
  },
  {
    range: "< 4.0",
    label: "Likely no: missing must-haves or red flags hit.",
    cls: "bg-red-500/15 text-red-300 ring-red-500/30",
  },
];

export default function ScoreExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <span className="text-[13px] font-medium text-white/80">
          How scoring works
        </span>
        <span
          className={`text-[12px] text-white/40 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="animate-fm-fade-up space-y-4 border-t border-white/10 px-4 py-4">
          <div className="space-y-2">
            {BANDS.map((b) => (
              <div key={b.range} className="flex items-start gap-3">
                <span
                  className={`inline-block shrink-0 rounded-md px-2 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums ring-1 ring-inset ${b.cls}`}
                  style={{ minWidth: 62 }}
                >
                  {b.range}
                </span>
                <span className="text-[13px] leading-relaxed text-white/65">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[12.5px] leading-relaxed text-white/50">
            Each candidate is scored against this role&apos;s must-haves from
            your job description: coverage, depth, and any red flags, read from
            the interview transcript. The same rubric is applied every time.
          </p>
          <p className="rounded-xl border border-purple-500/25 bg-purple-500/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-purple-200/90">
            Treat this as a screening signal to help you rank and shortlist, not
            a hiring decision. Always skim the transcript before you act on it.
          </p>
        </div>
      )}
    </div>
  );
}

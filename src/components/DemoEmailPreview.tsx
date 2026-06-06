"use client";

import { useEffect } from "react";
import { buildNextRoundDraft } from "@/lib/inviteEmail";

type Props = {
  open: boolean;
  onClose: () => void;
  candidate: { name: string; email: string };
  roleTitle: string;
};

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 5l5.5 4 5.5-4" />
    </svg>
  );
}

export default function DemoEmailPreview({
  open,
  onClose,
  candidate,
  roleTitle,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { subject, body } = buildNextRoundDraft({
    candidate,
    roleTitle,
    recruiterFirstName: null,
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-sm animate-fm-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Next-round email preview"
    >
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl animate-fm-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2 text-white">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <MailIcon />
            </div>
            <div>
              <div className="text-[14.5px] font-semibold">
                Next-round email
              </div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-purple-300">
                Demo preview
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Email body */}
        <div className="px-6 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <dl className="mb-4 space-y-1.5 border-b border-white/10 pb-4 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-mono uppercase tracking-wide text-white/40">
                  To
                </dt>
                <dd className="text-white/85">{candidate.email}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-mono uppercase tracking-wide text-white/40">
                  Subject
                </dt>
                <dd className="text-white/85">{subject}</dd>
              </div>
            </dl>
            <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-white/85">
              {body}
            </pre>
          </div>

          <p className="mt-4 text-[12px] text-white/55">
            In the real product, this opens your default mail client with the
            draft pre-filled. You can edit it before sending. PurpleHire never
            sends email on your behalf.
          </p>
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-stretch gap-2 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12px] text-white/45">
            Sign in to send this from your own Gmail or Outlook.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:bg-white/5 hover:text-white"
            >
              Close
            </button>
            <a
              href="/signin"
              className="ph-grad-btn-bg inline-flex items-center justify-center rounded-full px-4 py-2 text-[13px] font-medium text-white shadow-glow-purple-sm transition-transform hover:-translate-y-0.5"
            >
              Sign in to send
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

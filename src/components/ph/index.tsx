/**
 * PurpleHire design system — reusable components.
 * Translated from the Claude Design bundle (ph-components.jsx).
 * Tailwind classes only. CSS animations map to Framer Motion names
 * so we can swap to <motion.X> later if needed.
 */
import type { ReactNode, SVGProps } from "react";

type SvgIconProps = SVGProps<SVGSVGElement>;

/* ---------- ICONS ---------- */
export const ChevronRight = (p: SvgIconProps) => (
  <svg
    viewBox="0 0 16 16"
    className={p.className ?? "h-4 w-4"}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export const ArrowRight = (p: SvgIconProps) => (
  <svg
    viewBox="0 0 16 16"
    className={p.className ?? "h-4 w-4"}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export const Check = (p: SvgIconProps) => (
  <svg
    viewBox="0 0 16 16"
    className={p.className ?? "h-3.5 w-3.5"}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

export const Copy = (p: SvgIconProps) => (
  <svg
    viewBox="0 0 16 16"
    className={p.className ?? "h-3.5 w-3.5"}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <rect x="5" y="5" width="9" height="9" rx="2" />
    <path d="M3 11V4a1 1 0 0 1 1-1h7" />
  </svg>
);

/* ---------- LOGO ---------- */
type PHLogoProps = {
  size?: "sm" | "md" | "lg";
  mark?: boolean;
  wordmark?: boolean;
};
export function PHLogo({
  size = "md",
  mark = true,
  wordmark = true,
}: PHLogoProps) {
  const sz = { sm: "h-6 text-base", md: "h-8 text-lg", lg: "h-10 text-xl" }[
    size
  ];
  return (
    <div className={`inline-flex items-center gap-2.5 ${sz}`}>
      {mark && (
        <div className="ph-grad-btn-bg shadow-glow-purple-sm flex aspect-square h-full items-center justify-center rounded-xl font-semibold text-white">
          P
        </div>
      )}
      {wordmark && (
        <span className="font-medium tracking-tight text-white">PurpleHire</span>
      )}
    </div>
  );
}

/* ---------- BUTTON ---------- */
type PHButtonProps = {
  children: ReactNode;
  variant?: "primary" | "ghost" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  state?: "default" | "hover" | "focus" | "disabled" | "loading";
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
};
export function PHButton({
  children,
  variant = "primary",
  size = "md",
  state = "default",
  icon,
  iconRight,
  className = "",
  type = "button",
  onClick,
  disabled,
}: PHButtonProps) {
  const base =
    "group relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-200 select-none";
  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-[15px]",
    lg: "h-12 px-6 text-base",
  }[size];
  const variants = {
    primary:
      "ph-grad-btn-bg text-white shadow-glow-purple-sm hover:shadow-glow-purple hover:-translate-y-px active:translate-y-0 active:scale-[.98]",
    ghost:
      "text-white/85 border border-white/15 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/25",
    secondary: "bg-white text-black hover:bg-white/90 active:scale-[.98]",
    danger:
      "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25",
  }[variant];
  const stateCls = {
    disabled: "opacity-40 pointer-events-none",
    focus: "outline-none ring-2 ring-purple-500/60 ring-offset-2 ring-offset-black",
    loading: "pointer-events-none",
    hover: "",
    default: "",
  }[state];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes} ${variants} ${stateCls} ${className}`}
    >
      {state === "loading" && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeOpacity=".25"
            strokeWidth="2.5"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {icon && state !== "loading" && icon}
      <span>{children}</span>
      {iconRight && (
        <span className="transition-transform duration-200 group-hover:translate-x-0.5">
          {iconRight}
        </span>
      )}
    </button>
  );
}

/* ---------- BADGES ---------- */
type PHFitBadgeProps = { score: number; animated?: boolean };
export function PHFitBadge({ score, animated = false }: PHFitBadgeProps) {
  const tier =
    score >= 85
      ? {
          bg: "bg-emerald-500/15",
          br: "border-emerald-500/30",
          tx: "text-emerald-300",
        }
      : score >= 70
        ? {
            bg: "bg-yellow-500/15",
            br: "border-yellow-500/30",
            tx: "text-yellow-300",
          }
        : {
            bg: "bg-red-500/15",
            br: "border-red-500/30",
            tx: "text-red-300",
          };
  return (
    <span
      className={`inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-full border px-2.5 font-mono text-[13px] font-medium tabular-nums ${tier.bg} ${tier.br} ${tier.tx} ${animated ? "animate-fm-fade-in" : ""}`}
    >
      {score}
    </span>
  );
}

type PHEyebrowProps = { children: ReactNode; live?: boolean };
export function PHEyebrow({ children, live = false }: PHEyebrowProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium tracking-wide text-white/75">
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 animate-fm-pulse-dot rounded-full bg-purple-500" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
        </span>
      )}
      {children}
    </span>
  );
}

type PHTagProps = { children: ReactNode };
export function PHTag({ children }: PHTagProps) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/60">
      {children}
    </span>
  );
}

/* ---------- AVATAR ---------- */
type PHAvatarProps = {
  letter?: string;
  size?: "sm" | "md" | "lg";
  brand?: boolean;
};
const AVATAR_TINTS: Record<string, string> = {
  M: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20",
  D: "bg-yellow-500/15 text-yellow-200 ring-yellow-500/20",
  P: "bg-purple-500/15 text-purple-200 ring-purple-500/20",
  A: "bg-sky-500/15 text-sky-200 ring-sky-500/20",
  J: "bg-rose-500/15 text-rose-200 ring-rose-500/20",
  L: "bg-teal-500/15 text-teal-200 ring-teal-500/20",
  R: "bg-orange-500/15 text-orange-200 ring-orange-500/20",
  S: "bg-indigo-500/15 text-indigo-200 ring-indigo-500/20",
};
export function PHAvatar({
  letter = "P",
  size = "md",
  brand = false,
}: PHAvatarProps) {
  const sz = {
    sm: "h-7 w-7 text-[12px]",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
  }[size];
  if (brand) {
    return (
      <div
        className={`ph-grad-btn-bg flex items-center justify-center rounded-full font-semibold text-white ${sz}`}
      >
        {letter}
      </div>
    );
  }
  const tint =
    AVATAR_TINTS[letter] ?? "bg-white/10 text-white/80 ring-white/10";
  return (
    <div
      className={`flex items-center justify-center rounded-full font-medium ring-1 ring-inset ${sz} ${tint}`}
    >
      {letter}
    </div>
  );
}

/* ---------- CANDIDATE ROW ---------- */
type PHCandidateRowProps = {
  letter: string;
  name: string;
  role?: string;
  score: number;
  tags?: string[];
  shimmer?: boolean;
  compact?: boolean;
};
export function PHCandidateRow({
  letter,
  name,
  role,
  score,
  tags = [],
  shimmer = false,
  compact = false,
}: PHCandidateRowProps) {
  return (
    <div
      className={[
        "group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] transition-all",
        compact ? "p-2.5" : "p-3",
        "hover:border-white/20 hover:-translate-y-px hover:bg-white/[0.04]",
      ].join(" ")}
    >
      {shimmer && (
        <div className="ph-shimmer-bg animate-fm-shimmer pointer-events-none absolute inset-0 rounded-2xl" />
      )}
      <PHAvatar letter={letter} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <div
            className={`truncate font-medium text-white ${compact ? "text-[13px]" : "text-[14px]"}`}
          >
            {name}
          </div>
          {role && (
            <div className="truncate text-[11px] text-white/40">· {role}</div>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => (
              <PHTag key={t}>{t}</PHTag>
            ))}
          </div>
        )}
      </div>
      <PHFitBadge score={score} />
    </div>
  );
}

/* ---------- LIVE MOCK CANDIDATE PANEL (marketing hero right side) ---------- */
export function PHMockPanel() {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 shadow-card-lift">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
            Role
          </div>
          <div className="mt-0.5 truncate text-[15px] font-medium text-white">
            Senior React Engineer
          </div>
          <div className="truncate text-[12px] text-white/50">
            Series B fintech · Remote (US)
          </div>
        </div>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
          <Check />
          Parsed
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
          Top candidates
        </div>
        <div className="font-mono text-[11px] text-white/50">47 interviewed</div>
      </div>

      <div className="flex flex-col gap-2">
        <PHCandidateRow
          letter="M"
          name="Maya R."
          score={94}
          tags={["React", "TypeScript", "Design systems"]}
        />
        <PHCandidateRow
          letter="D"
          name="Daniel K."
          score={91}
          tags={["React", "Node", "GraphQL"]}
          shimmer
        />
        <PHCandidateRow
          letter="P"
          name="Priya S."
          score={87}
          tags={["React Native", "Performance"]}
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[12px]">
        <div className="flex items-center gap-2 text-white/55">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-fm-pulse-dot rounded-full bg-purple-500" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
          </span>
          3 interviews in progress
        </div>
        <div className="text-white/35">Last completed 2 min ago</div>
      </div>
    </div>
  );
}

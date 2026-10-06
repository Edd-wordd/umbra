import type { ReactNode } from "react";
import type { DevTone } from "@/lib/dev/format";

export const TEXT_TONE: Record<DevTone, string> = {
  active: "text-active",
  attention: "text-attention",
  broken: "text-broken",
  mid: "text-mid",
  dim: "text-dim",
};

const DOT_TONE: Record<DevTone, string> = {
  active: "bg-active glow-active",
  attention: "bg-attention glow-attention",
  broken: "bg-broken glow-broken",
  mid: "border border-mid",
  dim: "border border-dim",
};

/** 5px state dot. Only activity states fill and glow; idle ones are hollow. */
export function Dot({ tone, pulse = false }: { tone: DevTone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-[5px] w-[5px] shrink-0">
      <span className={`h-[5px] w-[5px] rounded-full ${DOT_TONE[tone]}`} />
      {pulse && <span className="animate-umbra-ring absolute -inset-[3px] rounded-full border border-active/50" />}
    </span>
  );
}

export function SectionHead({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-[16px] items-center gap-[12px] text-[9.5px] leading-none">
      <span className="shrink-0 whitespace-nowrap tracking-[2px] text-mid">{title}</span>
      {meta && <span className="min-w-0 truncate text-dim">{meta}</span>}
      {children && <span className="ml-auto flex shrink-0 items-center gap-[10px]">{children}</span>}
    </div>
  );
}

type BtnTone = "attention" | "plain" | "quiet";
const BTN: Record<BtnTone, string> = {
  attention: "border-attention/80 text-attention hover:bg-attention/10",
  plain: "border-line-strong text-mid hover:border-dim hover:text-ink",
  quiet: "border-transparent text-dim hover:text-ink",
};

export function Btn({
  tone = "plain",
  children,
  onClick,
  title,
  disabled,
}: {
  tone?: BtnTone;
  children: ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-[18px] shrink-0 border px-[7px] text-[9px] leading-none tracking-[1px] transition-colors disabled:opacity-40 ${BTN[tone]}`}
    >
      {children}
    </button>
  );
}

/** Amber "needs your yes" strip. Used inline wherever a risky action was requested. */
export function ApprovalStrip({
  command,
  reason,
  onApprove,
  onDeny,
  hint,
}: {
  command: string;
  reason: string;
  onApprove: () => void;
  onDeny: () => void;
  hint?: string;
}) {
  return (
    <div className="umbra-pop relative border border-attention/40 bg-attention/[0.04] py-[8px] pl-[12px] pr-[10px]" role="alertdialog" aria-label="needs your yes">
      <span className="glow-attention absolute -left-px top-[-1px] bottom-[-1px] w-[2px] bg-attention" />
      <div className="flex items-center gap-[10px] text-[9px] leading-none tracking-[2px] text-attention">
        <span>NEEDS YOUR YES</span>
        <span className="truncate tracking-[0.5px] text-attention/70">{reason}</span>
      </div>
      <div className="mt-[7px] flex items-center gap-[8px]">
        <code className="min-w-0 flex-1 truncate text-[11px] text-ink">{command}</code>
        {hint && <span className="shrink-0 text-[9px] text-dim">{hint}</span>}
        <Btn tone="attention" onClick={onApprove}>
          APPROVE
        </Btn>
        <Btn onClick={onDeny}>DENY</Btn>
      </div>
    </div>
  );
}

const CHIP: Record<DevTone, string> = {
  active: "border-active/60 text-active",
  attention: "border-attention/70 text-attention",
  broken: "border-broken/70 text-broken",
  mid: "border-line-strong text-mid",
  dim: "border-line text-dim",
};
const GLYPH: Partial<Record<DevTone, string>> = { active: "◌", attention: "!", broken: "✕" };

/** Service chip on a project row. Color only when the service needs attention or is running. */
export function Chip({ label, tone, title, onClick }: { label: string; tone: DevTone; title?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex h-[16px] shrink-0 items-center gap-[4px] border px-[5px] text-[9px] leading-none transition-colors hover:text-ink ${CHIP[tone]}`}
    >
      {label}
      {GLYPH[tone] && <span className="text-[8px]">{GLYPH[tone]}</span>}
    </button>
  );
}

/** Tiny 1px trend line (no chart lib). */
export function Spark({ values, tone = "mid", width = 64, height = 14 }: { values: number[]; tone?: DevTone; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 1 - ((v - lo) / (hi - lo || 1)) * (height - 2)).toFixed(1)}`)
    .join(" ");
  const last = pts.split(" ").at(-1)!.split(",");
  return (
    <svg width={width} height={height} className={`shrink-0 ${TEXT_TONE[tone]}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.7} />
      <circle cx={last[0]} cy={last[1]} r={1.6} fill="currentColor" />
    </svg>
  );
}

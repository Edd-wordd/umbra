import type { ReactNode } from "react";
import type { DevTone } from "@/lib/dev/format";
import { Glyph, type GlyphState } from "@/components/ui/Glyph";

export const TEXT_TONE: Record<DevTone, string> = {
  active: "text-active",
  attention: "text-attention",
  broken: "text-broken",
  mid: "text-mid",
  dim: "text-dim",
};

const DOT_TONE: Record<DevTone, string> = {
  active: "bg-active glow-active",
  attention: "bg-attention",
  broken: "bg-broken",
  mid: "border border-mid",
  dim: "border border-dim",
};

/** 5px square state mark. Only activity states fill; idle ones are hollow. */
export function Dot({ tone, pulse = false }: { tone: DevTone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-[5px] w-[5px] shrink-0">
      <span className={`h-[5px] w-[5px] ${DOT_TONE[tone]}`} />
      {pulse && <span className="animate-umbra-ring absolute -inset-[3px] border border-active/40" />}
    </span>
  );
}

/** Spaced uppercase section key, e.g. `NEEDS YOU   4`. */
export function SectionHead({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-[16px] items-center gap-[14px]">
      <span className="label shrink-0 whitespace-nowrap text-dim">{title}</span>
      {meta && <span className="label min-w-0 truncate text-ghost">{meta}</span>}
      {children && <span className="ml-auto flex shrink-0 items-center gap-[8px]">{children}</span>}
    </div>
  );
}

type BtnTone = "attention" | "plain" | "quiet" | "primary";
const BTN: Record<BtnTone, string> = {
  /** Approve-type actions: white outline, fills white on hover. */
  attention: "border-ink/80 text-ink hover:bg-active hover:text-black",
  primary: "border-active bg-active text-black hover:bg-ink",
  plain: "border-line-strong text-mid hover:border-mid hover:text-ink",
  quiet: "border-transparent text-dim hover:text-ink",
};

/** Inline action, drawn as an outlined tile with a spaced uppercase label. */
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
      className={`h-[17px] shrink-0 border px-[6px] text-[8.5px] uppercase leading-none tracking-[0.16em] transition-colors disabled:opacity-40 ${BTN[tone]}`}
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
    <div className="umbra-pop relative border border-line-strong py-[8px] pl-[12px] pr-[10px]" role="alertdialog" aria-label="needs your yes">
      <span className="absolute -left-px top-[-1px] bottom-[-1px] w-[2px] bg-attention" />
      <div className="flex items-center gap-[12px]">
        <span className="label text-attention">NEEDS YOUR YES</span>
        <span className="label truncate text-dim">{reason}</span>
      </div>
      <div className="mt-[7px] flex items-center gap-[8px]">
        <code className="min-w-0 flex-1 truncate text-[11px] text-ink">{command}</code>
        {hint && <span className="shrink-0 text-[9px] text-dim">{hint}</span>}
        <Btn tone="primary" onClick={onApprove}>
          APPROVE
        </Btn>
        <Btn onClick={onDeny}>DENY</Btn>
      </div>
    </div>
  );
}

const TONE_GLYPH: Record<DevTone, GlyphState> = { active: "active", attention: "attention", broken: "broken", mid: "ok", dim: "idle" };
export const glyphState = (t: DevTone): GlyphState => TONE_GLYPH[t];

/** Service tile on a project row (a Glyph keyed by activity tone). */
export function Chip({ label, tone, title, onClick }: { label: string; tone: DevTone; title?: string; onClick?: () => void }) {
  return <Glyph code={label} state={TONE_GLYPH[tone]} title={title} onClick={onClick ?? (() => {})} />;
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

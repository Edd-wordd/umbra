import type { ReactNode } from "react";
import { accentOf } from "@/lib/dev/colors";
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
export function Dot({ tone, title }: { tone: DevTone; title?: string }) {
  return <span title={title} className={`inline-block h-[5px] w-[5px] shrink-0 rounded-full ${DOT_TONE[tone]}`} />;
}

/** Project identity: a small dot in the project's accent (the same color as its notification emoji). */
export function AccentDot({ repo }: { repo?: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[6px] w-[6px] shrink-0 rounded-full opacity-90"
      style={repo ? { background: accentOf(repo).hex } : { border: "1px solid currentColor" }}
    />
  );
}

export function SectionHead({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex h-[16px] items-center gap-[12px] text-[9.5px] leading-none">
      <span className="shrink-0 whitespace-nowrap tracking-[2px] text-mid">{title}</span>
      {meta && <span className="min-w-0 truncate text-dim">{meta}</span>}
    </div>
  );
}

/** Small text jump: `herdr ↗`, `cursor ↗`. Never bubbles to the row underneath. */
export function Jump({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="shrink-0 whitespace-nowrap text-[9.5px] text-dim transition-colors hover:text-active"
    >
      {label} ↗
    </button>
  );
}

/** `localhost:PORT ↗` (only rendered while something listens there). */
export function LocalLink({ port, short = false }: { port: number; short?: boolean }) {
  return (
    <a
      href={`http://localhost:${port}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`open http://localhost:${port}`}
      className="shrink-0 whitespace-nowrap text-[9.5px] tabular-nums text-dim transition-colors hover:text-active"
    >
      {short ? `:${port} ↗` : `localhost:${port} ↗`}
    </a>
  );
}

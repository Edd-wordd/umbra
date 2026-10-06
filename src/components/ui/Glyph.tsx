import type { ReactNode } from "react";

/**
 * Data glyph tile: the basic Dataland building block. A tiny outlined box
 * with a 1–4 character code (G github, S sentry, AG agent, :3002 port…).
 *
 *   idle       gray outline, gray code (exists, nothing happening)
 *   ok         lighter outline (healthy, connected)
 *   active     solid white tile, black code (running / on)
 *   attention  white outline + amber notch (needs you)
 *   broken     red outline, red code, red notch
 */
export type GlyphState = "idle" | "ok" | "active" | "attention" | "broken";

const BOX: Record<GlyphState, string> = {
  idle: "border-ghost text-dim",
  ok: "border-dim text-mid",
  active: "border-active bg-active text-black",
  attention: "border-ink/80 text-ink",
  broken: "border-broken/90 text-broken",
};
const NOTCH: Partial<Record<GlyphState, string>> = { attention: "bg-attention", broken: "bg-broken" };

export function Glyph({
  code,
  state = "idle",
  size = "sm",
  title,
  onClick,
  className = "",
}: {
  code: ReactNode;
  state?: GlyphState;
  size?: "xs" | "sm" | "md";
  title?: string;
  onClick?: () => void;
  className?: string;
}) {
  const dims = size === "xs" ? "h-[12px] min-w-[12px] px-[2px] text-[7px]" : size === "md" ? "h-[18px] min-w-[20px] px-[4px] text-[9px]" : "h-[14px] min-w-[15px] px-[3px] text-[8px]";
  const cls = `relative inline-flex shrink-0 items-center justify-center border leading-none tracking-[0.08em] uppercase tabular-nums ${dims} ${BOX[state]} ${className}`;
  const notch = NOTCH[state] && <span className={`absolute -bottom-px left-[-1px] h-[2px] w-[55%] ${NOTCH[state]}`} />;
  if (!onClick)
    return (
      <span className={cls} title={title} data-glyph={state}>
        {code}
        {notch}
      </span>
    );
  return (
    <button
      type="button"
      title={title}
      data-glyph={state}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`${cls} transition-colors ${state === "active" ? "hover:bg-ink" : "hover:border-mid hover:text-ink"}`}
    >
      {code}
      {notch}
    </button>
  );
}

/** Solid white status / progress bar (Dataland's filled bars). */
export function Bar({ value, width = 64, tone = "active", height = 6 }: { value: number; width?: number; tone?: "active" | "broken" | "dim"; height?: number }) {
  const fill = tone === "broken" ? "bg-broken" : tone === "dim" ? "bg-dim" : "bg-active";
  return (
    <span className="relative inline-block shrink-0 bg-line" style={{ width, height }} aria-hidden>
      <span className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}

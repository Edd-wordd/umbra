"use client";

import { useEffect } from "react";
import { RAIL_SAMPLE, getRail, type Tone } from "@/lib/rails";
import { railOf, useUmbra } from "@/lib/store";
import { formatClock } from "@/lib/time";
import DevFocus from "./devfocus/DevFocus";

const TONE: Record<Tone, string> = {
  ink: "text-ink",
  mid: "text-mid",
  dim: "text-dim",
  active: "text-active",
  attention: "text-attention",
  broken: "text-broken",
};

const IDLE_COLLAPSE_MS = 20_000;
const pct = (y: number) => `${((y / 1080) * 100).toFixed(3)}%`;

/**
 * The single awake rail, docked to its edge tick (not a floating window).
 * Esc, click outside, or 20s without input returns to idle.
 * The Dev rail opens the expanded Dev focus instead, which stays awake while
 * open (Esc or the DEV tick closes it).
 */
export default function RailPanel() {
  const mode = useUmbra((s) => s.mode);
  const since = useUmbra((s) => s.since);
  const toIdle = useUmbra((s) => s.toIdle);
  const openPalette = useUmbra((s) => s.openPalette);
  const paletteOpen = useUmbra((s) => s.paletteOpen);
  const id = railOf(mode);
  const sticky = id === "dev";

  // Click / tap outside the rail (and its tick) returns to idle.
  useEffect(() => {
    if (!id || sticky) return;
    const onDown = (e: PointerEvent) => {
      if (useUmbra.getState().paletteOpen) return;
      const el = e.target as Element | null;
      if (!el?.closest("[data-keep-rail]")) toIdle();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [id, sticky, toIdle]);

  // Collapse after 20s with no input.
  useEffect(() => {
    if (!id || sticky || paletteOpen) return;
    let timer = setTimeout(toIdle, IDLE_COLLAPSE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(toIdle, IDLE_COLLAPSE_MS);
    };
    const evts = ["pointermove", "pointerdown", "keydown", "wheel"] as const;
    evts.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      evts.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [id, sticky, paletteOpen, toIdle]);

  if (!id) return null;
  if (id === "dev") return <DevFocus />;
  const rail = getRail(id);
  const content = RAIL_SAMPLE[id];
  const left = rail.side === "left";
  // Connector from the end of the tick label to the panel edge.
  const labelEnd = 26 + rail.label.length * 8 + 6;

  return (
    <>
      <div
        className="pointer-events-none absolute h-px bg-active/60"
        style={{ top: pct(rail.y), ...(left ? { left: labelEnd, width: 100 - labelEnd } : { right: labelEnd, width: 112 - labelEnd }) }}
      />
      <section
        key={id}
        data-keep-rail
        data-panel={id}
        aria-label={`${rail.label} rail`}
        className={`absolute top-[120px] flex max-h-[calc(100%-240px)] w-[400px] flex-col border border-line bg-panel ${
          left ? "umbra-slide-left left-[100px]" : "umbra-slide-right right-[112px]"
        }`}
      >
        <span className={`glow-active absolute top-[-1px] bottom-[-1px] w-px bg-active/70 ${left ? "-left-px" : "-right-px"}`} />
        <header className="px-5 pt-[20px]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[12px] font-normal tracking-[4px] text-active">{rail.label}</h2>
            <span className="border border-attention/50 px-[6px] py-[2px] text-[9.5px] tracking-[2px] text-attention/80">
              SAMPLE DATA
            </span>
          </div>
          <p className="mt-[8px] text-[9.5px] text-dim">touched {formatClock(new Date(since))} · esc / 20s idle to collapse</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
          {content.sections.map((sec) => (
            <div key={sec.title} className="mt-[20px] border-t border-line pt-[12px]">
              <div className="flex justify-between text-[9.5px]">
                <span className="tracking-[2px] text-mid">{sec.title}</span>
                {sec.source && <span className="text-dim">{sec.source}</span>}
              </div>
              <div className="mt-[6px]">
                {sec.rows.map((row, i) => (
                  <div key={i} className="flex gap-[14px] py-[4px] text-[10.5px] leading-[1.4]">
                    {row.cells.map((c, j) => (
                      <span
                        key={j}
                        className={`${TONE[c.tone ?? "ink"]} ${c.align === "end" ? "ml-auto text-right" : ""} whitespace-pre`}
                      >
                        {c.text}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-line px-5 py-[14px] text-[10px]">
          <div className="flex gap-[16px]">
            {content.actions.length === 0 && <span className="text-ghost">no actions yet</span>}
            {content.actions.map((a) => (
              <button
                key={a.toolId}
                type="button"
                className="text-dim transition-colors hover:text-ink"
                title={a.toolId}
                onClick={() => openPalette(a.toolId)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <span className="text-[9.5px] text-ghost">say or ⌘K</span>
        </footer>
      </section>
    </>
  );
}

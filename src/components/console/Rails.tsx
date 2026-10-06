"use client";

import { RAILS, type RailDef } from "@/lib/rails";
import { railOf, useUmbra } from "@/lib/store";

const pct = (y: number) => `${((y / 1080) * 100).toFixed(3)}%`;

function Tick({ rail, awake, dimmed }: { rail: RailDef; awake: boolean; dimmed: boolean }) {
  const toggleRail = useUmbra((s) => s.toggleRail);
  const left = rail.side === "left";
  return (
    <button
      type="button"
      data-keep-rail
      data-rail={rail.id}
      aria-pressed={awake}
      aria-label={`${rail.label} rail`}
      onClick={() => toggleRail(rail.id)}
      className={`group absolute flex -translate-y-1/2 items-center gap-[8px] py-[10px] transition-opacity duration-300 ${
        left ? "left-[4px] pr-4" : "right-[4px] flex-row-reverse pl-4"
      }`}
      style={{ top: pct(rail.y), opacity: dimmed ? 0.5 : 1 }}
    >
      <span
        className={`block h-px w-[14px] transition-colors ${
          awake ? "glow-active h-[1.5px] bg-active" : "bg-dim group-hover:bg-mid"
        }`}
      />
      <span
        className={`text-[10px] leading-none tracking-[2px] transition-colors ${
          awake ? "text-active" : "text-dim group-hover:text-mid"
        }`}
      >
        {rail.label}
      </span>
    </button>
  );
}

/** Edge rails: tiny labeled ticks. Left: DEV, LAB/NET, PRINT. Right: ASTRO, BUSINESS, CAMERAS, KNOWLEDGE. */
export default function Rails() {
  const mode = useUmbra((s) => s.mode);
  const awake = railOf(mode);
  const anyAwake = awake !== null || mode === "astro";
  return (
    <nav aria-label="rails">
      <div className="absolute left-[10px] w-px bg-line" style={{ top: pct(290), height: pct(320) }} />
      <div className="absolute right-[10px] w-px bg-line" style={{ top: pct(290), height: pct(440) }} />
      {RAILS.map((r) => {
        const isAwake = awake === r.id || (mode === "astro" && r.id === "astro");
        return <Tick key={r.id} rail={r} awake={isAwake} dimmed={anyAwake && !isAwake} />;
      })}
    </nav>
  );
}

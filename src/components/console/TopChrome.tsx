"use client";

import { useEffect, useRef } from "react";
import { useDevStore } from "@/lib/dev/store";
import { useMinuteClock } from "@/lib/hooks/useClock";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { VOICE_STATES, useUmbra, type VoiceState } from "@/lib/store";
import { formatClock, formatDateLine } from "@/lib/time";
import { voiceLevel } from "@/lib/voice/level";

type Health = "ok" | "down" | "unknown";

/** Bridge-health heartbeats. "mac" is the Mac helper (live); the rest are placeholders until their bridges exist. */
const HEALTH: { id: string; label: string; state: Health }[] = [
  { id: "bridge", label: "bridge", state: "ok" },
  { id: "pi", label: "pi", state: "ok" },
  { id: "mac", label: "mac", state: "ok" },
  { id: "printer", label: "printer", state: "ok" },
];

function useMacHealth(): { state: Health; title: string; pulse: boolean } {
  const helper = useDevStore((s) => s.helper);
  switch (helper.state) {
    case "live":
      return { state: "ok", pulse: false, title: `mac: helper live · ${helper.hostname ?? ""}${helper.herdr ? ` · herdr ${helper.herdr}` : ""}` };
    case "connecting":
      return { state: "unknown", pulse: true, title: "mac: connecting to the helper…" };
    case "down":
      return { state: "down", pulse: false, title: `mac: helper unreachable · ${helper.error ?? "start it with pnpm helper"}` };
    default:
      return { state: "unknown", pulse: false, title: "mac: helper not configured · `pnpm helper` prints the .env.local lines" };
  }
}

function Wordmark({ dim }: { dim: boolean }) {
  const mac = useMacHealth();
  return (
    <div className="absolute left-10 top-[40px] transition-opacity duration-300" style={{ opacity: dim ? 0.6 : 1 }}>
      <div className="text-[12px] leading-none tracking-[5px] text-mid">UMBRA</div>
      <ul className="mt-[14px] flex gap-[16px] text-[9.5px] leading-none tracking-[1px] text-dim" aria-label="bridge health">
        {HEALTH.map((h) => {
          const state = h.id === "mac" ? mac.state : h.state;
          const title = h.id === "mac" ? mac.title : `${h.label}: ${h.state} (placeholder)`;
          return (
            <li key={h.id} className="flex items-center gap-[5px]" title={title} data-health={h.id} data-state={state}>
              <span
                className={`inline-block h-[4px] w-[4px] rounded-full ${
                  state === "down" ? "bg-broken glow-broken" : state === "unknown" ? `border border-dim bg-transparent ${h.id === "mac" && mac.pulse ? "animate-pulse" : ""}` : "bg-dim"
                }`}
              />
              {h.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Clock() {
  const now = useMinuteClock();
  const mode = useUmbra((s) => s.mode);
  return (
    <div className="absolute left-1/2 top-[34px] -translate-x-1/2 text-center">
      <time
        className="block text-[44px] font-extralight leading-none tracking-[4px] text-ink tabular-nums"
        dateTime={now?.toISOString()}
        suppressHydrationWarning
      >
        {now ? formatClock(now) : "--:--"}
      </time>
      <div className="mt-[12px] text-[10px] leading-none tracking-[3px] text-dim" suppressHydrationWarning>
        {now ? formatDateLine(now) : "\u00a0"}
      </div>
      {mode === "astro" && (
        <div className="mt-[16px] text-[10px] leading-none tracking-[4px] text-active">MODE · ASTRO</div>
      )}
    </div>
  );
}

const BARS = 12;

/** Live waveform bars driven by the voice level bus (refs only, no re-render). */
function Waveform({ reducedMotion }: { reducedMotion: boolean }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const lvl = reducedMotion ? 0.5 : voiceLevel.current;
      bars.current.forEach((b, i) => {
        if (!b) return;
        const h = 3 + lvl * 18 * (0.5 + 0.5 * Math.abs(Math.sin(t * 9 + i * 1.3)));
        b.style.height = `${h.toFixed(1)}px`;
      });
      if (!reducedMotion) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);
  return (
    <span className="flex h-[22px] items-center gap-[3.5px]" aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className="block w-[1.5px] bg-active opacity-85"
          style={{ height: 3 }}
        />
      ))}
    </span>
  );
}

function VoiceIndicator() {
  const voice = useUmbra((s) => s.voice);
  const reducedMotion = useReducedMotion();
  const active = voice !== "idle";
  return (
    <div
      className="absolute right-10 top-[41px] flex flex-col items-end"
      role="status"
      aria-label={`voice ${voice}`}
      data-voice={voice}
    >
      <div className="flex h-[18px] items-center gap-[8px]">
        {voice === "speaking" && <Waveform reducedMotion={reducedMotion} />}
        <span className="relative flex h-[12px] w-[12px] items-center justify-center">
          {active ? (
            <>
              <span className="glow-active h-[10px] w-[10px] rounded-full bg-active" />
              {voice === "thinking" ? (
                <span className="absolute -inset-[5px] animate-spin rounded-full border border-dashed border-active/60 [animation-duration:3s]" />
              ) : (
                <span className="animate-umbra-ring absolute -inset-[5px] rounded-full border border-active/60" />
              )}
            </>
          ) : (
            <span className="h-[12px] w-[12px] rounded-full border border-dim" />
          )}
        </span>
        <span className={`text-[10px] leading-none tracking-[2px] ${active ? "text-active" : "text-dim"}`}>
          VOICE · {voice.toUpperCase()}
        </span>
      </div>
      <div className="mt-[10px] flex gap-[12px] text-[9.5px] leading-none">
        {VOICE_STATES.map((s: VoiceState) => (
          <span key={s} className={s === voice ? (active ? "text-active" : "text-mid") : "text-ghost"}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TopChrome() {
  const mode = useUmbra((s) => s.mode);
  return (
    <>
      <Wordmark dim={mode === "astro"} />
      <Clock />
      <VoiceIndicator />
    </>
  );
}

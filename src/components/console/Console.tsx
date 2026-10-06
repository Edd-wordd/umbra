"use client";

import { useEffect } from "react";
import { devAttention, useDevStore } from "@/lib/dev/store";
import { DOMAINS, type DomainId } from "@/lib/graph";
import { useUmbra } from "@/lib/store";
import { startVoiceSimulation } from "@/lib/voice/level";
import CoreStage from "../core/CoreStage";
import BottomStrips from "./BottomStrips";
import CommandPalette from "./CommandPalette";
import RailPanel from "./RailPanel";
import Rails from "./Rails";
import TopChrome from "./TopChrome";

/** Dev helpers (V = simulate voice) are on in `pnpm dev`, or with ?dev in a build. */
const devHelpersEnabled = () =>
  process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("dev");

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

/** Global keys: Cmd/Ctrl-K palette, Esc back to idle, V / Shift-V voice simulation (dev). */
function useConsoleKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useUmbra.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (s.paletteOpen) s.closePalette();
        else s.openPalette();
        return;
      }
      if (e.key === "Escape") {
        if (s.paletteOpen) s.closePalette();
        else if (s.mode !== "idle" || s.voice !== "idle") s.toIdle();
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || s.paletteOpen) return;
      if (e.key.toLowerCase() === "v" && devHelpersEnabled()) {
        e.preventDefault();
        if (e.shiftKey) s.cycleVoice();
        else s.toggleVoiceSim();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Demo deep links: `/?rail=<id>` wakes a rail; `/?focus=dev` opens the Dev focus; `&mock=quiet` = good-day sample. */
function useDeepLink() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // `?mock=quiet` loads the good-day sample (nothing needs you).
    if (q.get("mock") === "quiet") useDevStore.getState().loadMock("quiet");
    const want = q.get("focus") ?? q.get("rail");
    if (want && (DOMAINS as readonly string[]).includes(want)) useUmbra.getState().wakeRail(want as DomainId);
  }, []);
}

/** Mirrors the Dev workspace's worst state into the console's attention map (core sector + rail tick). */
function useDevAttention() {
  useEffect(() => {
    const sync = () => useUmbra.getState().setAttention("dev", devAttention(useDevStore.getState()));
    sync();
    return useDevStore.subscribe(sync);
  }, []);
}

/** Drives the voice level bus with a fake speaking envelope while simulating. */
function useVoiceSimulation() {
  const sim = useUmbra((s) => s.voiceSim);
  useEffect(() => {
    if (!sim) return;
    return startVoiceSimulation();
  }, [sim]);
}

/** Full-screen silent console (idle wireframe WF-01). */
export default function Console() {
  useConsoleKeys();
  useVoiceSimulation();
  useDeepLink();
  useDevAttention();
  const mode = useUmbra((s) => s.mode);

  return (
    <main className="umbra-grid fixed inset-0 bg-bg select-none overflow-hidden" data-mode={mode}>
      <div className="umbra-vignette pointer-events-none absolute inset-0" />
      <CoreStage />
      <TopChrome />
      <Rails />
      <RailPanel />
      <BottomStrips />
      <CommandPalette />
    </main>
  );
}

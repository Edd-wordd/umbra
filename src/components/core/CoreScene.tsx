"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { sampleLayout, type CoreLayout, type DomainId } from "@/lib/graph";
import type { VoiceState } from "@/lib/store";
import { voiceLevel } from "@/lib/voice/level";
import { CORE_HOME, coreFocusView } from "../console/devfocus/layout";
import { CoreRuntime, type SectorAttention } from "./runtime";

export interface CoreSceneProps {
  layout?: CoreLayout;
  /** Sector lit cyan (the awake rail / mode), or null at idle. */
  litDomain: DomainId | null;
  voice: VoiceState;
  /**
   * Voice audio level 0..1, written to the `uLevel` uniform. Omit to read the
   * shared voice level bus (simulated with V in dev; LiveKit TTS RMS in Phase 3).
   */
  level?: number;
  reducedMotion: boolean;
  /** Per-domain attention (amber / red bracket on that sector). */
  attention?: Partial<Record<DomainId, Exclude<SectorAttention, null>>>;
  /** Dev focus open: park the core beside the workspace. */
  focus?: boolean;
}

const IDLE_FPS = 10;

export default function CoreScene({ layout = sampleLayout, litDomain, voice, level, reducedMotion, attention, focus = false }: CoreSceneProps) {
  const invalidate = useThree((s) => s.invalidate);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const runtime = useMemo(() => new CoreRuntime(layout), [layout]);
  useEffect(() => () => runtime.dispose(), [runtime]);

  const litIndex = litDomain ? layout.sectorIndex[litDomain] : -1;
  const speaking = voice === "speaking";
  const attn = useMemo(
    () => layout.sectors.map((sec) => attention?.[sec.domain] ?? null),
    [layout, attention],
  );
  const view = useMemo(() => (focus ? coreFocusView(width, height) : CORE_HOME), [focus, width, height]);

  // Any state change: render until the transition settles.
  useEffect(() => {
    runtime.wake();
    invalidate();
  }, [runtime, litIndex, voice, level, reducedMotion, attn, view, invalidate]);

  // Throttled loop (frameloop="demand"): ~10 fps breathe tick at idle, full
  // rate while transitioning or speaking, nothing while the tab is hidden,
  // and only on change when reduced motion is on.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const full = runtime.busy || (speaking && !reducedMotion);
      if (full || (!reducedMotion && now - last >= 1000 / IDLE_FPS)) {
        last = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [runtime, invalidate, speaking, reducedMotion]);

  useFrame((state, delta) => {
    const lvl = speaking ? (level ?? (reducedMotion ? 0.5 : voiceLevel.current)) : 0;
    runtime.update(
      { litIndex, voiceOn: voice !== "idle", speaking, level: lvl, reducedMotion, attention: attn, view },
      state.clock.elapsedTime,
      delta,
      state.camera.zoom * state.gl.getPixelRatio(),
    );
  });

  return <primitive object={runtime.root} />;
}

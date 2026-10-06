/**
 * Voice level bus. ONE number (0..1) per frame drives the core's voice glow
 * (halo scale/opacity, pulse ring, ripples) and the top-right waveform.
 *
 * It is a plain mutable object, not React state, so per-frame writes never
 * re-render anything. Phase 3 replaces the simulator with the RMS of the
 * LiveKit TTS track (AnalyserNode), smoothed the same way.
 */
export const voiceLevel = { current: 0 };

/** Fake speech envelope: ~4.5 syllables/s, ~2.6s phrases with ~0.6s gaps. */
function envelope(t: number): number {
  const ph = t % 3.2;
  if (ph > 2.6) return 0.04 * Math.random();
  const syl = Math.max(0, Math.sin(t * Math.PI * 4.5 + Math.sin(t * 1.7) * 1.5));
  return Math.min(1, (0.35 + 0.65 * Math.abs(Math.sin(t * 0.9))) * syl * syl * (0.8 + 0.4 * Math.random()));
}

/**
 * Starts writing a simulated speaking envelope into `voiceLevel` with fast
 * attack / slow release smoothing. Returns a stop function that releases the
 * level back to 0.
 */
export function startVoiceSimulation(): () => void {
  const t0 = performance.now();
  let raf = 0;
  let stopping = false;
  const frame = (now: number) => {
    const target = stopping ? 0 : envelope((now - t0) / 1000);
    const lvl = voiceLevel.current;
    voiceLevel.current = lvl + (target - lvl) * (target > lvl ? 0.45 : 0.08);
    if (stopping && voiceLevel.current < 0.002) {
      voiceLevel.current = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    stopping = true;
    // Keep the loop alive for the release tail; it ends itself at ~0.
    if (!raf) raf = requestAnimationFrame(frame);
  };
}

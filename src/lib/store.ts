"use client";

import { create } from "zustand";
import type { RailId } from "./rails";
import type { DomainId } from "./graph";

/** Console mode. Exactly one thing is awake at a time. */
export type Mode = "idle" | `rail:${RailId}` | "voice" | "astro";
export type VoiceState = "idle" | "listening" | "thinking" | "speaking";
export const VOICE_STATES: readonly VoiceState[] = ["idle", "listening", "thinking", "speaking"];

export const isRailMode = (m: Mode): m is `rail:${RailId}` => m.startsWith("rail:");
export const railOf = (m: Mode): RailId | null => (isRailMode(m) ? (m.slice(5) as RailId) : null);

/** Which core sector is lit for a given mode (null = none). */
export function litDomain(m: Mode): DomainId | null {
  if (m === "astro") return "astro";
  return railOf(m);
}

interface UmbraState {
  mode: Mode;
  /** When the current mode began (ms epoch). */
  since: number;
  voice: VoiceState;
  /** Dev-only simulated speaking envelope (press V). */
  voiceSim: boolean;
  paletteOpen: boolean;
  paletteQuery: string;
  /** Last tool result line (shown briefly in the focus strip). */
  lastResult: { message: string; ok: boolean; at: number } | null;

  setMode: (mode: Mode) => void;
  wakeRail: (id: RailId) => void;
  toggleRail: (id: RailId) => void;
  toIdle: () => void;
  setVoice: (v: VoiceState) => void;
  cycleVoice: () => void;
  toggleVoiceSim: () => void;
  openPalette: (query?: string) => void;
  closePalette: () => void;
  setPaletteQuery: (q: string) => void;
  setLastResult: (r: { message: string; ok: boolean }) => void;
}

export const useUmbra = create<UmbraState>()((set, get) => ({
  mode: "idle",
  since: 0,
  voice: "idle",
  voiceSim: false,
  paletteOpen: false,
  paletteQuery: "",
  lastResult: null,

  setMode: (mode) => set({ mode, since: Date.now() }),
  wakeRail: (id) => set({ mode: `rail:${id}`, since: Date.now() }),
  toggleRail: (id) => set({ mode: get().mode === `rail:${id}` ? "idle" : `rail:${id}`, since: Date.now() }),
  toIdle: () => set({ mode: "idle", since: Date.now(), voice: "idle", voiceSim: false }),
  setVoice: (voice) => set({ voice, mode: voice === "idle" ? "idle" : "voice", voiceSim: voice === "speaking" && get().voiceSim }),
  cycleVoice: () => {
    const i = VOICE_STATES.indexOf(get().voice);
    const voice = VOICE_STATES[(i + 1) % VOICE_STATES.length];
    set({ voice, voiceSim: voice === "speaking", mode: voice === "idle" ? "idle" : "voice" });
  },
  toggleVoiceSim: () => {
    const on = !get().voiceSim;
    set({ voiceSim: on, voice: on ? "speaking" : "idle", mode: on ? "voice" : "idle" });
  },
  openPalette: (query = "") => set({ paletteOpen: true, paletteQuery: query }),
  closePalette: () => set({ paletteOpen: false, paletteQuery: "" }),
  setPaletteQuery: (paletteQuery) => set({ paletteQuery }),
  setLastResult: (r) => set({ lastResult: { ...r, at: Date.now() } }),
}));

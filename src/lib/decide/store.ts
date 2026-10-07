"use client";

import { create } from "zustand";
import { useDevStore } from "../dev/store";
import type { DevSignal } from "../dev/signals";
import { decideMany } from "./client";
import { combineTriage, type TriageAnswers, type TriageDecision } from "./triage";

/**
 * Triage decisions, cached per signal id (a signal is decided once). The
 * Needs-you list and project chips read from here; every decision is
 * written to the Dev activity log.
 */
interface TriageState {
  /** The signals currently in play (state-derived + streamed). */
  signals: DevSignal[];
  decisions: Record<string, TriageDecision>;
  inflight: Record<string, true>;
  /** Idempotent: only unseen ids are sent; a no-op when nothing changed. */
  request: (signals: DevSignal[]) => void;
}

const LABEL: Record<string, string> = {
  "ci.failed": "ci failed",
  "agent.waiting": "agent waiting",
  "agent.failed": "agent failed",
  "agent.done": "agent done",
  "container.restarts": "container restarts",
  "sentry.spike": "sentry spike",
  "lead.new": "new lead",
  "unpushed.stale": "unpushed work",
  "posthog.spike": "traffic spike",
  "deps.update": "dependabot",
  "port.stale": "stale port",
  service: "service",
};
const PLACE = { "needs-you": "you", chip: "chip", log: "log" } as const;

/** "→ you · ci failed parallax · 4/5 · 54% · jev" (placement first so it survives truncation). */
function logDecision(s: DevSignal, d: TriageDecision) {
  const where = s.repo ?? (s.kind === "lead.new" ? "deadbridge" : s.source);
  const text = `→ ${PLACE[d.placement]}${d.unsure ? "?" : ""} · ${LABEL[s.kind] ?? s.kind} ${where} · ${Math.round(d.urgency)}/5 · ${Math.round(d.confidence * 100)}% · ${d.source}`;
  useDevStore.getState().log("triage", text, "info");
}

const sameIds = (a: DevSignal[], b: DevSignal[]) => a.length === b.length && a.every((x, i) => x.id === b[i].id);

export const useTriageStore = create<TriageState>()((set, get) => ({
  signals: [],
  decisions: {},
  inflight: {},

  request: (signals) => {
    const { decisions, inflight } = get();
    const fresh = signals.filter((x) => !decisions[x.id] && !inflight[x.id]);
    const changed = !sameIds(get().signals, signals);
    if (!fresh.length) {
      if (changed) set({ signals });
      return;
    }
    const mark = { ...inflight };
    for (const x of fresh) mark[x.id] = true;
    set({ signals, inflight: mark });

    void decideMany(
      "triage",
      fresh.map((x) => ({ id: x.id, input: x })),
    ).then((results) => {
      const byId = new Map(fresh.map((x) => [x.id, x]));
      const next = { ...get().decisions };
      const still = { ...get().inflight };
      for (const r of results) {
        const sig = byId.get(r.id);
        if (!sig) continue;
        const d = combineTriage(sig, r.answers as TriageAnswers, { source: r.source, model: r.model, ms: r.ms, fallback: r.fallback });
        next[r.id] = d;
        delete still[r.id];
        logDecision(sig, d);
      }
      for (const x of fresh) delete still[x.id];
      set({ decisions: next, inflight: still });
    });
  },
}));

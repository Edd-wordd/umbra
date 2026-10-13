"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useDevStore } from "@/lib/dev/store";
import { litDomain, useUmbra } from "@/lib/store";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { brainSummaryToCoreState } from "./brain-state";
import CoreLabels from "./CoreLabels";
import type { CoreSceneProps } from "./CoreScene";

// The WebGL canvas is client-only and code-split out of the first paint.
const CoreCanvas = dynamic(() => import("./CoreCanvas"), { ssr: false, loading: () => null });

/** Center brain v0: single R3F canvas + SVG label overlay, behind all chrome. */
export default function CoreStage({ brainSummary, visualGraph, selectedNodeId }: { brainSummary?: import("../console/useBrainSummary").BrainSummary | null; visualGraph?: import("@/lib/brain/visual").BrainVisualGraph | null; selectedNodeId?: string | null }) {
  const mode = useUmbra((s) => s.mode);
  const voice = useUmbra((s) => s.voice);
  const reducedMotion = useReducedMotion();
  const attention = useUmbra((s) => s.attention);
  const lit = litDomain(mode);
  const focus = mode === "rail:dev";
  const focusOpen = useDevStore((s) => !!s.sessions[s.selectedId] || s.expandedProject !== null);
  const brain = useMemo(() => brainSummaryToCoreState(brainSummary ?? null), [brainSummary]);
  const levels = useMemo(
    () => Object.fromEntries(Object.entries(attention).map(([d, a]) => [d, a.level])) as CoreSceneProps["attention"],
    [attention],
  );

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="core" data-attention={attention.dev?.level ?? "none"}>
      <CoreCanvas litDomain={lit} voice={voice} reducedMotion={reducedMotion} attention={levels} focus={focus} focusOpen={focusOpen} brain={brain} visualGraph={visualGraph ?? undefined} selectedNodeId={selectedNodeId ?? undefined} />
      <CoreLabels litDomain={lit} attention={attention} hidden={focus} />
    </div>
  );
}

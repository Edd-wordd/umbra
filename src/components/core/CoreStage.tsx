"use client";

import dynamic from "next/dynamic";
import { litDomain, useUmbra } from "@/lib/store";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import CoreLabels from "./CoreLabels";

// The WebGL canvas is client-only and code-split out of the first paint.
const CoreCanvas = dynamic(() => import("./CoreCanvas"), { ssr: false, loading: () => null });

/** Center brain v0: single R3F canvas + SVG label overlay, behind all chrome. */
export default function CoreStage() {
  const mode = useUmbra((s) => s.mode);
  const voice = useUmbra((s) => s.voice);
  const reducedMotion = useReducedMotion();
  const lit = litDomain(mode);

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="core">
      <CoreCanvas litDomain={lit} voice={voice} reducedMotion={reducedMotion} />
      <CoreLabels litDomain={lit} />
    </div>
  );
}

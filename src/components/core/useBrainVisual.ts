"use client";

import { useEffect, useState } from "react";
import type { BrainVisualGraph } from "@/lib/brain/visual";

export function useBrainVisual(refreshMs = 15_000) {
  const [graph, setGraph] = useState<BrainVisualGraph | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/brain/visual", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((next: BrainVisualGraph | null) => {
          if (!cancelled) setGraph(next);
        })
        .catch(() => {
          if (!cancelled) setGraph(null);
        });
    };
    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshMs]);
  return graph;
}

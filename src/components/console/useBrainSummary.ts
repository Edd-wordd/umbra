"use client";

import { useEffect, useState } from "react";

export type BrainDomainSource = "live" | "partial" | "sample" | "not_configured";

export type BrainSummaryDomain = {
  id: string;
  status: string;
  source: BrainDomainSource;
  configured: boolean;
  needs: number;
  notes: string[];
};

export type BrainSummary = {
  generatedAt: number;
  domains: BrainSummaryDomain[];
  attention: BrainSummaryDomain[];
  totals: { needs: number; approvals: number; timeline: number };
  latestTimeline: unknown;
};

export function useBrainSummary(refreshMs = 15_000) {
  const [summary, setSummary] = useState<BrainSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/brain/summary", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((next: BrainSummary | null) => {
          if (!cancelled) setSummary(next);
        })
        .catch(() => {
          if (!cancelled) setSummary(null);
        });
    };
    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshMs]);
  return summary;
}

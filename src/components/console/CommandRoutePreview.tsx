"use client";

import { useEffect, useState } from "react";
import { routeCommand } from "@/lib/commands";
import type { CommandRoute } from "@/lib/commands/types";

export function CommandRoutePreview({ query }: { query: string }) {
  const [route, setRoute] = useState<CommandRoute | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void routeCommand(trimmed).then((next) => {
        if (!cancelled) setRoute(next.unresolved ? null : next);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (!route?.action || !route.plan) return null;

  return (
    <div className="border-t border-line px-[22px] py-[12px] text-[10px]">
      <div className="tracking-[2px] text-active">ROUTE PREVIEW · {Math.round(route.confidence * 100)}% · {route.source}</div>
      <div className="mt-[8px] text-[13px] text-ink">{route.action.label}</div>
      <div className="mt-[6px] text-dim">
        {route.plan.summary}
        {route.plan.target ? ` → ${route.plan.target}` : ""}
      </div>
      <div className={route.requiresApproval ? "mt-[6px] text-attention" : "mt-[6px] text-mid"}>
        {route.action.risk} · {route.requiresApproval ? "approval required" : "no approval"}
      </div>
    </div>
  );
}

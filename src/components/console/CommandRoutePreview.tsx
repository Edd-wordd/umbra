"use client";

import { useEffect, useState } from "react";
import type { ActionPlan, UmbraAction } from "@/lib/actions/types";

export type ClientCommandRoute = {
  input: string;
  source: "local" | "jev";
  actionId?: string;
  confidence: number;
  reason: string;
  args: Record<string, string>;
  action?: Pick<UmbraAction, "id" | "label" | "risk" | "domain">;
  requiresApproval?: boolean;
  plan?: ActionPlan;
  unresolved?: boolean;
};

function compactPreview(preview: string) {
  return preview.split("\n").slice(0, 8).join("\n");
}

export function CommandRoutePreview({ query, onPrepare }: { query: string; onPrepare?: (route: ClientCommandRoute) => void }) {
  const [route, setRoute] = useState<ClientCommandRoute | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch("/api/commands/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((next: ClientCommandRoute | null) => {
          if (!cancelled) setRoute(!next || next.unresolved ? null : next);
        })
        .catch(() => {
          if (!cancelled) setRoute(null);
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
      {route.plan.preview && <div className="mt-[8px] border border-line/70 bg-black/20 p-[8px] text-[9px] leading-4 text-dim whitespace-pre-wrap">{compactPreview(route.plan.preview)}</div>}
      <div className="mt-[8px] flex items-center justify-between gap-[12px]">
        <div className={route.requiresApproval ? "text-attention" : "text-mid"}>
          {route.action.risk} · {route.requiresApproval ? "approval required" : "no approval"}
        </div>
        {onPrepare && (
          <button type="button" onClick={() => onPrepare(route)} className="border border-line px-[10px] py-[4px] tracking-[1.5px] text-dim hover:border-active hover:text-active">
            PREPARE
          </button>
        )}
      </div>
    </div>
  );
}

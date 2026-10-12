"use client";

import { useEffect, useState } from "react";

type KnowledgeIndex = {
  configured: boolean;
  accepted: number;
  rejected: number;
  graph: { nodes: unknown[]; edges: unknown[] };
  rejectedSamples?: Array<{ path: string; reason: string }>;
  error?: string;
};

type Timeline = {
  timeline: Array<{ id: string; kind: string; summary: string; detail?: string }>;
};

export default function KnowledgeRailContent({ openPalette }: { openPalette: (query?: string) => void }) {
  const [index, setIndex] = useState<KnowledgeIndex | null>(null);
  const [timeline, setTimeline] = useState<Timeline["timeline"]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/knowledge/index", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
      fetch("/api/ops/timeline", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
    ]).then(([knowledge, opsTimeline]: [KnowledgeIndex | null, Timeline | null]) => {
      if (cancelled) return;
      setIndex(knowledge);
      setTimeline((opsTimeline?.timeline ?? []).filter((item) => item.detail?.startsWith("knowledge.") || item.summary.includes("50_Decisions") || item.summary.includes("60_Logs") || item.summary.includes("40_Runbooks")).slice(0, 4));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="mt-[20px] border-t border-line pt-[12px]">
        <div className="flex justify-between text-[9.5px]">
          <span className="tracking-[2px] text-mid">VAULT</span>
          <span className="text-dim">live</span>
        </div>
        <div className="mt-[6px] space-y-[6px] text-[10.5px] leading-[1.4]">
          {!index && <p className="text-dim">loading…</p>}
          {index && !index.configured && <p className="text-attention">{index.error ?? "vault not configured"}</p>}
          {index?.configured && (
            <>
              <p className="text-ink">{index.accepted} typed notes</p>
              <p className={index.rejected ? "text-attention" : "text-mid"}>{index.rejected} need structure</p>
              <p className="text-dim">{index.graph.nodes.length} graph nodes · {index.graph.edges.length} edges</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-[20px] border-t border-line pt-[12px]">
        <div className="flex justify-between text-[9.5px]">
          <span className="tracking-[2px] text-mid">LATEST</span>
          <span className="text-dim">timeline</span>
        </div>
        <div className="mt-[6px] space-y-[6px] text-[10.5px] leading-[1.4]">
          {timeline.length === 0 && <p className="text-dim">no knowledge writes yet</p>}
          {timeline.map((item) => (
            <p key={item.id} className="text-dim">
              <span className="text-mid">{item.kind.replace("action.", "")}</span> · {item.summary}
            </p>
          ))}
        </div>
      </div>

      {index?.rejectedSamples?.length ? (
        <div className="mt-[20px] border-t border-line pt-[12px]">
          <div className="flex justify-between text-[9.5px]">
            <span className="tracking-[2px] text-mid">NEEDS STRUCTURE</span>
            <span className="text-dim">sample</span>
          </div>
          <div className="mt-[6px] space-y-[6px] text-[10.5px] leading-[1.4]">
            {index.rejectedSamples.slice(0, 4).map((item) => (
              <p key={item.path} className="text-attention">{item.path} · {item.reason}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-[20px] border-t border-line pt-[12px]">
        <div className="flex justify-between text-[9.5px]">
          <span className="tracking-[2px] text-mid">ACTIONS</span>
          <span className="text-dim">approved writes</span>
        </div>
        <div className="mt-[10px] flex flex-wrap gap-[12px] text-[10px]">
          <button type="button" onClick={() => openPalette("create session note")} className="text-dim hover:text-ink">session</button>
          <button type="button" onClick={() => openPalette("create decision ")} className="text-dim hover:text-ink">decision</button>
          <button type="button" onClick={() => openPalette("create runbook ")} className="text-dim hover:text-ink">runbook</button>
        </div>
      </div>
    </>
  );
}

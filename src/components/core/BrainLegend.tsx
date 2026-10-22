"use client";

import { useRouter } from "next/navigation";
import type { BrainVisualGraph, BrainVisualNode } from "@/lib/brain/visual";
import { DOMAINS, type DomainId } from "@/lib/graph";
import { useUmbra } from "@/lib/store";

export default function BrainLegend({ graph, hidden = false, selectedNodeId, onSelect }: { graph: BrainVisualGraph | null; hidden?: boolean; selectedNodeId?: string | null; onSelect?: (id: string) => void }) {
  const router = useRouter();
  const wakeRail = useUmbra((s) => s.wakeRail);
  if (hidden || !graph) return null;
  const nodes = graph.nodes
    .filter((node) => node.kind !== "domain")
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);
  if (!nodes.length) return null;
  return (
    <div className="absolute left-1/2 top-[calc(50%+170px)] z-10 w-[420px] -translate-x-1/2 text-center text-[9px] leading-5 text-dim" aria-label="brain visual legend">
      <div className="tracking-[2.5px] text-ghost">BRAIN</div>
      <div className="mt-[4px] flex flex-col items-center gap-[1px]">
        {nodes.map((node) => (
          <button key={node.id} type="button" onClick={() => { onSelect?.(node.id); openNode(node, wakeRail, router.push); }} className={`max-w-full truncate hover:text-ink ${selectedNodeId === node.id ? "text-ink" : ""}`} data-keep-rail>
            <span className={toneClass(node)}>{node.domain}</span>
            <span className="text-ghost"> · </span>
            <span>{node.label}</span>
            <span className="text-ghost"> · </span>
            <span>{node.status}</span>
            {node.notes?.[0] ? <span className="text-ghost"> · {node.notes[0]}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function openNode(node: BrainVisualNode, wakeRail: (id: DomainId) => void, push: (href: string) => void) {
  if (node.domain === "ops") {
    push("/ops");
    return;
  }
  if ((DOMAINS as readonly string[]).includes(node.domain)) wakeRail(node.domain as DomainId);
}

function toneClass(node: BrainVisualNode) {
  if (["blocked", "down", "unreachable", "error", "refused"].includes(String(node.status))) return "text-broken";
  if (["watch", "approval", "pending", "auth_required", "timeout", "tls_error"].includes(String(node.status))) return "text-attention";
  return "text-active";
}

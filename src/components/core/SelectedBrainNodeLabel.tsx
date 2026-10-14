"use client";

import type { BrainVisualGraph, BrainVisualNode } from "@/lib/brain/visual";

export default function SelectedBrainNodeLabel({ graph, selectedNodeId, hidden = false }: { graph: BrainVisualGraph | null; selectedNodeId?: string | null; hidden?: boolean }) {
  if (hidden || !graph || !selectedNodeId) return null;
  const node = graph.nodes.find((item) => item.id === selectedNodeId);
  if (!node) return null;
  return (
    <div className="absolute left-1/2 top-[calc(50%-170px)] z-10 w-[360px] -translate-x-1/2 text-center text-[9px] leading-5 text-dim" aria-label="selected brain node">
      <div className="tracking-[2.5px] text-ghost">SELECTED</div>
      <div className="mt-[4px] truncate">
        <span className={toneClass(node)}>{node.domain}</span>
        <span className="text-ghost"> · </span>
        <span className="text-ink">{node.label}</span>
        <span className="text-ghost"> · </span>
        <span>{node.status}</span>
      </div>
    </div>
  );
}

function toneClass(node: BrainVisualNode) {
  if (["blocked", "down", "unreachable", "error", "refused"].includes(String(node.status))) return "text-broken";
  if (["watch", "approval", "pending", "auth_required", "timeout", "tls_error"].includes(String(node.status))) return "text-attention";
  return "text-active";
}

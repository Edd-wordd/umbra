export type BrainVisualNodeKind = "domain" | "service" | "vault" | "approval" | "timeline" | "summary";
export type BrainVisualStatus = "silent" | "watch" | "approval" | "blocked" | "ok" | "down" | "pending" | "error";

export interface BrainVisualActionHint {
  label: string;
  command: string;
}

export interface BrainVisualNode {
  id: string;
  label: string;
  domain: string;
  kind: BrainVisualNodeKind;
  status: BrainVisualStatus | string;
  importance: number;
  notes?: string[];
  actions?: BrainVisualActionHint[];
}

export interface BrainVisualEdge {
  from: string;
  to: string;
  kind: string;
  strength: number;
}

export interface BrainVisualGraph {
  generatedAt: number;
  nodes: BrainVisualNode[];
  edges: BrainVisualEdge[];
}

export function addNode(nodes: BrainVisualNode[], node: BrainVisualNode) {
  if (!nodes.some((existing) => existing.id === node.id)) nodes.push(node);
}

export function addEdge(edges: BrainVisualEdge[], edge: BrainVisualEdge) {
  if (!edges.some((existing) => existing.from === edge.from && existing.to === edge.to && existing.kind === edge.kind)) edges.push(edge);
}

export function clampImportance(value: number) {
  return Math.max(0.05, Math.min(1, value));
}

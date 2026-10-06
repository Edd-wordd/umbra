import type { DomainId, Graph, GraphNode } from "./types";
import { DOMAIN_LABEL, hubId } from "./types";

/**
 * Deterministic polar layout for the "system core" (ported from the locked
 * wireframe generator, wireframes/src/build.mjs). Computed once, never
 * simulated per frame.
 *
 * Coordinates are in reference-frame pixels (1920x1080 frame), centered on
 * the core, with y pointing DOWN (SVG convention). The WebGL scene flips y.
 */

const K = 1.06;
export const RADII = {
  core: 22 * K,
  inner: 60 * K,
  hub: 120 * K,
  bus1: 150 * K,
  t1: 182 * K,
  bus2: 205 * K,
  t2: 230 * K,
  dial: 254 * K,
  label: 278 * K,
} as const;

/** Clockwise from 12 o'clock: Astro top-right ... Dev top-left. */
export const SECTOR_ORDER: readonly DomainId[] = [
  "astro",
  "business",
  "cameras",
  "knowledge",
  "print",
  "lab",
  "dev",
];
export const SECTOR_WIDTH = (2 * Math.PI) / SECTOR_ORDER.length;

/** Per-sector caps so dense sets (notes, leads) don't flood the core. */
const CAP_T1 = 6;
const CAP_T2: Partial<Record<DomainId, number>> = { dev: 8, knowledge: 5, business: 5 };
const CAP_T2_DEFAULT = 6;

export type Tier = 0 | 1 | 2;

export interface PlacedNode {
  id: string;
  node: GraphNode;
  domain: DomainId;
  tier: Tier;
  parent?: string;
  angle: number;
  radius: number;
  x: number;
  y: number;
}

export interface Sector {
  domain: DomainId;
  label: string;
  index: number;
  /** Center angle (radians, SVG convention). */
  angle: number;
  start: number;
  end: number;
  hub: string;
  t1: string[];
  t2: string[];
}

export interface Chord {
  a: DomainId;
  b: DomainId;
  weight: number;
}

export interface CoreLayout {
  sectors: Sector[];
  sectorIndex: Record<DomainId, number>;
  nodes: Map<string, PlacedNode>;
  chords: Chord[];
  shownCount: number;
  totalCount: number;
}

export const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];

export function sectorAngle(index: number): number {
  return -Math.PI / 2 + SECTOR_WIDTH / 2 + index * SECTOR_WIDTH;
}

export function computeCoreLayout(graph: Graph): CoreLayout {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind !== "contains") continue;
    const list = children.get(e.source) ?? [];
    list.push(e.target);
    children.set(e.source, list);
  }

  const placed = new Map<string, PlacedNode>();
  const place = (id: string, domain: DomainId, tier: Tier, angle: number, radius: number, parent?: string) => {
    const node = byId.get(id);
    if (!node) return;
    const [x, y] = polar(radius, angle);
    placed.set(id, { id, node, domain, tier, parent, angle, radius, x, y });
  };

  const sectorIndex = {} as Record<DomainId, number>;
  const sectors: Sector[] = SECTOR_ORDER.map((domain, index) => {
    sectorIndex[domain] = index;
    const a0 = sectorAngle(index);
    const hub = hubId(domain);
    place(hub, domain, 0, a0, RADII.hub);

    const sameDomain = (id: string) => byId.get(id)?.domain === domain;
    const t1 = (children.get(hub) ?? []).filter(sameDomain).slice(0, CAP_T1);
    const span1 = SECTOR_WIDTH * 0.74;
    t1.forEach((id, i) => place(id, domain, 1, a0 - span1 / 2 + (span1 * (i + 0.5)) / t1.length, RADII.t1, hub));

    const cand: { id: string; parent: string }[] = [];
    for (const p of t1) {
      for (const id of children.get(p) ?? []) {
        if (sameDomain(id) && !placed.has(id) && !cand.some((c) => c.id === id)) cand.push({ id, parent: p });
      }
    }
    const t2 = cand.slice(0, CAP_T2[domain] ?? CAP_T2_DEFAULT);
    const span2 = SECTOR_WIDTH * 0.8;
    t2.forEach(({ id, parent }, i) =>
      place(id, domain, 2, a0 - span2 / 2 + (span2 * (i + 0.5)) / t2.length, RADII.t2, parent),
    );

    return {
      domain,
      label: DOMAIN_LABEL[domain],
      index,
      angle: a0,
      start: a0 - SECTOR_WIDTH / 2,
      end: a0 + SECTOR_WIDTH / 2,
      hub,
      t1,
      t2: t2.map((c) => c.id),
    };
  });

  // Cross-domain links aggregated hub<->hub into faint inner chords.
  const chordW = new Map<string, number>();
  for (const e of graph.edges) {
    const a = byId.get(e.source)?.domain;
    const b = byId.get(e.target)?.domain;
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    chordW.set(key, (chordW.get(key) ?? 0) + 1);
  }
  const chords: Chord[] = [...chordW.entries()].map(([k, weight]) => {
    const [a, b] = k.split("|") as [DomainId, DomainId];
    return { a, b, weight };
  });

  return {
    sectors,
    sectorIndex,
    nodes: placed,
    chords,
    shownCount: placed.size,
    totalCount: graph.nodes.length,
  };
}

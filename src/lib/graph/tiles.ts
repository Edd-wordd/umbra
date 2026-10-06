import type { DomainId, Graph, GraphNode, NodeStatus } from "./types";
import { hubId } from "./types";
import { polar, SECTOR_ORDER, sectorAngle } from "./layout";

/**
 * "Data city" layout for the core: every graph node becomes a small outlined
 * glyph tile. Tiles group into seven districts (one per domain sector) on
 * rays out from a central nucleus; children stack outward along their
 * parent's ray, so a bigger graph makes the structure DENSER (more rays,
 * taller stacks, thinner tiles), never larger. Thin curved threads link
 * hubs to the nucleus, entities to hubs, and related nodes across districts.
 *
 * Coordinates: reference-frame px (1920x1080), centered, y DOWN (SVG). The
 * WebGL side flips y. Computed once; nothing is simulated per frame.
 */

export const TILE_R = {
  hub: 78,
  /** Inner edge (tower bases) of each district block. */
  entity: 122,
  /** Max footprint of a block across its towers. */
  block: 84,
  maxStack: 7,
  /** Position / tile-size scale applied after layout. */
  spread: 1.3,
  grow: 1.15,
  /** Outer edge of the structure (featured label columns sit beyond). */
  outer: 300,
} as const;

/** 0 hub, 1 entity, 2 leaf, 3 record (sub-row texture), 4 nucleus, 5 far field (fog/depth, not data). */
export type TileKind = 0 | 1 | 2 | 3 | 4 | 5;

export interface Tile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..6 domain sector, 7 nucleus, -1 never lit. */
  sector: number;
  kind: TileKind;
  status: NodeStatus;
  /** Inner mark: 0 none, 1 notch, 2 inner square, 3 two bars (far field: depth 0 far .. 3 near). */
  variant: number;
  seed: number;
  node?: GraphNode;
  angle: number;
  radius: number;
}

export interface Thread {
  pts: [number, number][];
  sector: number;
  /** Idle alpha (lit alpha is derived). */
  alpha: number;
  status: NodeStatus;
}

export interface District {
  domain: DomainId;
  index: number;
  angle: number;
  hub: Tile;
  code: string;
  /** Entities + leaves shown / total in that domain. */
  shown: number;
  total: number;
  /** Farthest tile edge from the center (rim label goes beyond it). */
  outer: number;
}

export interface TileLayout {
  tiles: Tile[];
  threads: Thread[];
  districts: District[];
  /** Tile per graph node id (records and nucleus excluded). */
  byNode: Map<string, Tile>;
}

export const DOMAIN_CODE: Record<DomainId, string> = {
  dev: "DEV",
  lab: "LAB",
  print: "PRT",
  astro: "AST",
  business: "BIZ",
  cameras: "CAM",
  knowledge: "KNW",
};

const CAP_ENTITIES = 12;
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

/** Quadratic Bézier sampled to a polyline. */
function curve(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, steps = 18): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
  }
  return out;
}

export function computeTileLayout(graph: Graph): TileLayout {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind !== "contains") continue;
    const list = children.get(e.source) ?? [];
    list.push(e.target);
    children.set(e.source, list);
  }

  const tiles: Tile[] = [];
  const threads: Thread[] = [];
  const districts: District[] = [];
  const byNode = new Map<string, Tile>();
  const add = (t: Omit<Tile, "seed" | "variant"> & { variant?: number }) => {
    const seed = hash(t.id);
    const tile: Tile = { variant: Math.floor(seed * 4), ...t, seed };
    tiles.push(tile);
    if (t.node) byNode.set(t.node.id, tile);
    return tile;
  };

  // Nucleus: 3x3 micro tiles at the center.
  for (let i = 0; i < 9; i++) {
    const gx = (i % 3) - 1;
    const gy = Math.floor(i / 3) - 1;
    add({ id: `nucleus:${i}`, x: gx * 9, y: gy * 7, w: i === 4 ? 8 : 6, h: i === 4 ? 6 : 4, sector: 7, kind: 4, status: "idle", angle: 0, radius: 0, variant: i === 4 ? 2 : 0 });
  }

  SECTOR_ORDER.forEach((domain, index) => {
    const a0 = sectorAngle(index);
    const [ux, uy] = polar(1, a0);
    // Each district is an orthogonal city block: entities are towers side by
    // side along `perp`, their children stack outward along `axis`.
    const vertical = Math.abs(uy) > Math.abs(ux);
    const axis: [number, number] = vertical ? [0, Math.sign(uy)] : [Math.sign(ux), 0];
    const perp: [number, number] = vertical ? [1, 0] : [0, 1];

    const hubNode = byId.get(hubId(domain));
    const [hx, hy] = polar(TILE_R.hub, a0).map(Math.round) as [number, number];
    const hub = add({ id: hubId(domain), x: hx, y: hy, w: 30, h: 13, sector: index, kind: 0, status: hubNode?.status ?? "idle", node: hubNode, angle: a0, radius: TILE_R.hub, variant: 0 });

    // Hub -> nucleus: a slow swirl.
    const [sx, sy] = polar(TILE_R.hub * 0.5, a0 + 0.42);
    threads.push({ pts: curve(hx, hy, sx, sy, 0, 0), sector: index, alpha: 0.12, status: "idle" });

    const sameDomain = (id: string) => byId.get(id)?.domain === domain;
    const allEntities = (children.get(hubId(domain)) ?? []).filter(sameDomain);
    const entities = allEntities.slice(0, CAP_ENTITIES);
    // Denser districts get thinner towers; the block footprint stays the same.
    const pitchP = Math.min(vertical ? 15 : 12, TILE_R.block / Math.max(1, entities.length));
    const thick = Math.max(4, Math.round(pitchP * (vertical ? 0.68 : 0.62)));
    const along = vertical ? { ent: 9, kid: 7, pitch: 12 } : { ent: 15, kid: 11, pitch: 18 };
    const [bx, by] = polar(TILE_R.entity, a0);
    let total = allEntities.length;
    let shown = entities.length;
    const dims = (len: number) => (vertical ? { w: thick, h: len } : { w: len, h: thick });

    entities.forEach((id, i) => {
      const node = byId.get(id)!;
      const off = (i - (entities.length - 1) / 2) * pitchP;
      const ex = Math.round(bx + perp[0] * off);
      const ey = Math.round(by + perp[1] * off);
      const ent = add({ id, x: ex, y: ey, ...dims(along.ent), sector: index, kind: 1, status: node.status ?? "idle", node, angle: a0, radius: Math.hypot(ex, ey) });

      // Entity -> hub: short bowed thread into the tower's base.
      const inX = ex - axis[0] * (along.ent / 2 + 2);
      const inY = ey - axis[1] * (along.ent / 2 + 2);
      threads.push({ pts: curve(hx, hy, inX - axis[0] * 14, inY - axis[1] * 14, inX, inY, 10), sector: index, alpha: 0.15, status: node.status ?? "idle" });

      // Records: micro bars at the tower's base (sub-rows of the source system).
      const recs = 2 + Math.floor(ent.seed * 3);
      for (let r = 0; r < recs; r++) {
        const d = along.ent / 2 + 4 + r * 4;
        add({ id: `${id}#r${r}`, x: Math.round(ex - axis[0] * d), y: Math.round(ey - axis[1] * d), ...(vertical ? { w: Math.max(2, thick - 2 - r), h: 2 } : { w: 2, h: Math.max(2, thick - 2 - r) }), sector: index, kind: 3, status: "idle", angle: a0, radius: 0, variant: 0 });
      }

      // Children stack outward along the axis (taller towers = more data).
      const kids = (children.get(id) ?? []).filter(sameDomain);
      total += kids.length;
      kids.slice(0, TILE_R.maxStack).forEach((kid, k) => {
        const knode = byId.get(kid)!;
        const d = along.ent / 2 + along.pitch * (k + 0.5) + 2;
        const kx = Math.round(ex + axis[0] * d);
        const ky = Math.round(ey + axis[1] * d);
        const kt = add({ id: kid, x: kx, y: ky, ...dims(along.kid), sector: index, kind: 2, status: knode.status ?? "idle", node: knode, angle: a0, radius: Math.hypot(kx, ky) });
        shown++;
        // Some stacked tiles carry a record bar beside them (window texture).
        if (kt.seed > 0.45) {
          const side = kt.seed > 0.72 ? 1 : -1;
          const o = thick / 2 + 3;
          add({ id: `${kid}#w`, x: Math.round(kx + perp[0] * o * side), y: Math.round(ky + perp[1] * o * side), ...(vertical ? { w: 2, h: 4 } : { w: 5, h: 2 }), sector: index, kind: 3, status: "idle", angle: a0, radius: 0, variant: 0 });
        }
      });
    });

    districts.push({ domain, index, angle: a0, hub, code: DOMAIN_CODE[domain], shown, total, outer: 0 });
  });

  // Cross-district threads: hub<->hub arcs through the middle, plus a few
  // node<->node links (depends / references) as long faint curves.
  const seen = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind === "contains") continue;
    const A = byNode.get(e.source);
    const B = byNode.get(e.target);
    if (!A || !B || A.sector === B.sector) continue;
    const key = [A.id, B.id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const k = 0.18 + hash(key) * 0.2;
    const status: NodeStatus = A.status === "broken" || B.status === "broken" ? "broken" : "idle";
    // A loose bundle of 3 strands reads as a light streak, not a wire.
    for (let s = 0; s < 3; s++) {
      const kk = k + (s - 1) * 0.07;
      threads.push({ pts: curve(A.x, A.y, (A.x + B.x) * kk, (A.y + B.y) * kk, B.x, B.y, 28), sector: -1, alpha: s === 1 ? 0.1 : 0.045, status });
    }
  }

  // Build at the base scale, then spread positions (density stays, the
  // structure just gets more breathing room) and slightly enlarge tiles.
  for (const t of tiles) {
    t.x = Math.round(t.x * TILE_R.spread);
    t.y = Math.round(t.y * TILE_R.spread);
    if (t.kind !== 3 && t.kind !== 4) {
      t.w = Math.round(t.w * TILE_R.grow);
      t.h = Math.round(t.h * TILE_R.grow);
    }
    t.radius *= TILE_R.spread;
  }
  for (const th of threads)
    for (const p of th.pts) {
      p[0] *= TILE_R.spread;
      p[1] *= TILE_R.spread;
    }

  // How far each district reaches (rim labels sit just beyond it).
  for (const t of tiles) {
    if (t.sector < 0 || t.sector > 6) continue;
    const d = districts[t.sector];
    d.outer = Math.max(d.outer, Math.hypot(t.x, t.y) + Math.max(t.w, t.h) / 2);
  }

  // Far field: a very faint lattice of distant micro tiles in vertical
  // columns around the structure, so the core sits in a "city" with depth
  // instead of floating on black. Deterministic, never lit, not data.
  for (let c = -36; c <= 36; c++) {
    const x = c * 13;
    for (let r = -36; r <= 36; r++) {
      const y = r * 9;
      const d = Math.hypot(x, y * 1.3);
      if (d < 335 || d > 500) continue;
      const fade = 1 - (d - 335) / 165;
      // Contiguous runs per column read as distant towers, not noise.
      if (hash(`blk${c}:${Math.floor((r + 30) / 4)}`) > 0.2 + 0.55 * fade) continue;
      const k = hash(`far${c}:${r}`);
      if (k > 0.86) continue;
      add({ id: `far${c}:${r}`, x, y, w: k > 0.6 ? 5 : 7, h: 3, sector: -1, kind: 5, status: "idle", angle: 0, radius: d, variant: Math.floor(fade * 3.99) });
    }
  }

  return { tiles, threads, districts, byNode };
}

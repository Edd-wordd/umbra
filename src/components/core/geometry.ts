import * as THREE from "three";
import type { CoreLayout, NodeStatus, PlacedNode } from "@/lib/graph";
import { polar, RADII, SECTOR_WIDTH } from "@/lib/graph";
import { activity, color } from "@/lib/theme/tokens";

/**
 * Builds the system core as THREE geometry from the graph layout:
 *  - one merged LineSegments geometry (rings, dial ticks, dividers, chords,
 *    pathways, core glyph)
 *  - one triangle geometry for faint lit-sector wedges
 *  - one Points geometry for hubs / leaves / core dot
 *
 * Every vertex carries its sector index, its idle alpha and its lit alpha, so
 * lighting a sector is a single uniform change (no geometry rebuilds).
 *
 * Sector index: 0..6 = domain sectors, 7 = core glyph, -1 = never lit.
 * Alphas are tuned to the locked IDLE wireframe (ring .10, path .075, node .30).
 */

export const CORE_SECTOR = 7;
const NONE = -1;

// WebGL draws crisp 1-device-px lines; the SVG wireframe's antialiased strokes
// read slightly heavier, so idle alphas get a small gain to match.
const GAIN = { line: 1.25, node: 1.3 };
const IDLE = { ring: 0.1 * GAIN.line, path: 0.075 * GAIN.line, node: 0.3 * GAIN.node };

const rgb = (hex: string) => new THREE.Color(hex).toArray() as [number, number, number];
const CYAN = rgb(activity.active);
const STATUS_RGB: Record<NodeStatus, [number, number, number]> = {
  idle: CYAN,
  ok: CYAN,
  attention: rgb(activity.attention),
  broken: rgb(activity.broken),
};
export const statusRgb = (s?: NodeStatus) => STATUS_RGB[s ?? "idle"];
export const statusHex = (s?: NodeStatus) =>
  s === "attention" ? activity.attention : s === "broken" ? activity.broken : activity.active;

class AttrBuilder {
  pos: number[] = [];
  alpha: number[] = [];
  lit: number[] = [];
  sector: number[] = [];
  litColor: number[] = [];

  vertex(x: number, y: number, a: number, la: number, s: number, c: readonly number[]) {
    // Layout is y-down (SVG); WebGL is y-up.
    this.pos.push(x, -y, 0);
    this.alpha.push(a);
    this.lit.push(la);
    this.sector.push(s);
    this.litColor.push(c[0], c[1], c[2]);
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("aAlpha", new THREE.Float32BufferAttribute(this.alpha, 1));
    g.setAttribute("aLitAlpha", new THREE.Float32BufferAttribute(this.lit, 1));
    g.setAttribute("aSector", new THREE.Float32BufferAttribute(this.sector, 1));
    g.setAttribute("aLitColor", new THREE.Float32BufferAttribute(this.litColor, 3));
    g.computeBoundingSphere();
    return g;
  }
}

interface Style {
  a: number;
  lit?: number;
  s?: number;
  c?: readonly number[];
}

class LineBuilder extends AttrBuilder {
  seg(x1: number, y1: number, x2: number, y2: number, st: Style) {
    const la = st.lit ?? 0;
    const s = st.s ?? NONE;
    const c = st.c ?? CYAN;
    this.vertex(x1, y1, st.a, la, s, c);
    this.vertex(x2, y2, st.a, la, s, c);
  }
  radial(a: number, r1: number, r2: number, st: Style) {
    const [x1, y1] = polar(r1, a);
    const [x2, y2] = polar(r2, a);
    this.seg(x1, y1, x2, y2, st);
  }
  arc(r: number, a1: number, a2: number, st: Style) {
    if (a2 < a1) [a1, a2] = [a2, a1];
    const steps = Math.max(2, Math.ceil(((a2 - a1) * r) / 4));
    for (let i = 0; i < steps; i++) {
      const t1 = a1 + ((a2 - a1) * i) / steps;
      const t2 = a1 + ((a2 - a1) * (i + 1)) / steps;
      const [x1, y1] = polar(r, t1);
      const [x2, y2] = polar(r, t2);
      this.seg(x1, y1, x2, y2, st);
    }
  }
  circle(r: number, st: Style) {
    this.arc(r, 0, Math.PI * 2, st);
  }
}

/** Clip a segment so the part inside radius `r` of the origin is removed. */
function clipOutsideCircle(x1: number, y1: number, x2: number, y2: number, r: number): [number, number, number, number][] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const A = dx * dx + dy * dy;
  const B = 2 * (x1 * dx + y1 * dy);
  const C = x1 * x1 + y1 * y1 - r * r;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return [[x1, y1, x2, y2]];
  const sq = Math.sqrt(disc);
  const t1 = (-B - sq) / (2 * A);
  const t2 = (-B + sq) / (2 * A);
  const out: [number, number, number, number][] = [];
  if (t1 > 0) out.push([x1, y1, x1 + dx * Math.min(t1, 1), y1 + dy * Math.min(t1, 1)]);
  if (t2 < 1) out.push([x1 + dx * Math.max(t2, 0), y1 + dy * Math.max(t2, 0), x2, y2]);
  return out;
}

export interface CoreGeometry {
  lines: THREE.BufferGeometry;
  wedges: THREE.BufferGeometry;
  points: THREE.BufferGeometry;
}

export function buildCoreGeometry(layout: CoreLayout): CoreGeometry {
  const L = new LineBuilder();
  const W = new AttrBuilder();
  const P = new AttrBuilder();
  const tiers: number[] = [];

  // Lit sector wedge fill + lit dial arc.
  for (const sec of layout.sectors) {
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a1 = sec.start + (SECTOR_WIDTH * i) / steps;
      const a2 = sec.start + (SECTOR_WIDTH * (i + 1)) / steps;
      const [o1x, o1y] = polar(RADII.dial, a1);
      const [o2x, o2y] = polar(RADII.dial, a2);
      const [i1x, i1y] = polar(RADII.inner, a1);
      const [i2x, i2y] = polar(RADII.inner, a2);
      for (const [x, y] of [
        [i1x, i1y],
        [o1x, o1y],
        [o2x, o2y],
        [i1x, i1y],
        [o2x, o2y],
        [i2x, i2y],
      ]) {
        W.vertex(x, y, 0, 0.035, sec.index, CYAN);
      }
    }
    L.arc(RADII.dial, sec.start + 0.004, sec.end - 0.004, { a: 0, lit: 0.55, s: sec.index });
    // Segmented inner ring.
    L.arc(RADII.inner, sec.start + 0.05, sec.end - 0.05, { a: IDLE.ring, lit: 0.5, s: sec.index });
    // Divider.
    L.radial(sec.start, RADII.inner + 6, RADII.dial + 12, { a: IDLE.ring * 0.55 });
  }

  // Hub ring, outer dial, 120 ticks.
  L.circle(RADII.hub, { a: IDLE.ring * 0.7 });
  L.circle(RADII.dial, { a: IDLE.ring });
  for (let i = 0; i < 120; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 60;
    const major = i % 5 === 0;
    L.radial(a, RADII.dial + 2, RADII.dial + (major ? 7 : 4), { a: IDLE.ring * (major ? 0.9 : 0.55) });
  }

  // Inner chords: cross-domain links aggregated hub<->hub, clear of the core.
  for (const ch of layout.chords) {
    const A = layout.nodes.get(`domain:${ch.a}`);
    const B = layout.nodes.get(`domain:${ch.b}`);
    if (!A || !B) continue;
    const a = Math.min(0.1, 0.035 + ch.weight * 0.006);
    for (const [x1, y1, x2, y2] of clipOutsideCircle(A.x, A.y, B.x, B.y, RADII.core + 16)) {
      L.seg(x1, y1, x2, y2, { a });
    }
  }

  // Per-sector pathways: spoke -> hub -> bus arc -> tier-1 -> bus arc -> tier-2.
  for (const sec of layout.sectors) {
    const s = sec.index;
    const a0 = sec.angle;
    const node = (id: string) => layout.nodes.get(id) as PlacedNode;
    L.radial(a0, RADII.core + 6, RADII.hub - 6, { a: IDLE.path * 1.3, lit: 0.7, s });
    if (sec.t1.length) {
      const as = sec.t1.map((id) => node(id).angle);
      L.radial(a0, RADII.hub + 6, RADII.bus1, { a: IDLE.path, lit: 0.6, s });
      L.arc(RADII.bus1, Math.min(a0, ...as), Math.max(a0, ...as), { a: IDLE.path, lit: 0.6, s });
      for (const id of sec.t1) {
        const n = node(id);
        L.radial(n.angle, RADII.bus1, RADII.t1 - 4, { a: IDLE.path, lit: 0.7, s, c: statusRgb(n.node.status) });
      }
    }
    const byParent = new Map<string, PlacedNode[]>();
    for (const id of sec.t2) {
      const n = node(id);
      const list = byParent.get(n.parent!) ?? [];
      list.push(n);
      byParent.set(n.parent!, list);
    }
    for (const [pid, kids] of byParent) {
      const pa = node(pid).angle;
      const as = kids.map((k) => k.angle);
      const lo = Math.min(pa, ...as);
      const hi = Math.max(pa, ...as);
      L.radial(pa, RADII.t1 + 4, RADII.bus2, { a: IDLE.path, lit: 0.6, s });
      if (hi - lo > 0.001) L.arc(RADII.bus2, lo, hi, { a: IDLE.path, lit: 0.6, s });
      for (const k of kids) {
        L.radial(k.angle, RADII.bus2, RADII.t2 - 3, { a: IDLE.path, lit: 0.75, s, c: statusRgb(k.node.status) });
      }
    }
  }

  // Core glyph (lights with any activity).
  L.circle(10, { a: 0.3, lit: 0.6, s: CORE_SECTOR });
  L.circle(RADII.core, { a: 0.18, lit: 0.4, s: CORE_SECTOR });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    L.radial(a, RADII.core - 4, RADII.core + 4, { a: 0.22, lit: 0.5, s: CORE_SECTOR });
  }

  // Points: hubs (tier 0), tier-1 / tier-2 leaves, core dot (tier 3).
  for (const n of layout.nodes.values()) {
    const s = layout.sectorIndex[n.domain];
    const a = n.tier === 0 ? Math.min(1, IDLE.node * 1.8) : n.tier === 1 ? IDLE.node * 1.3 : IDLE.node;
    P.vertex(n.x, n.y, a, 1, s, statusRgb(n.node.status));
    tiers.push(n.tier);
  }
  P.vertex(0, 0, 0.6, 1, CORE_SECTOR, CYAN);
  tiers.push(3);
  const points = P.geometry();
  points.setAttribute("aTier", new THREE.Float32BufferAttribute(tiers, 1));

  return { lines: L.geometry(), wedges: W.geometry(), points };
}

export const BASE_RGB = rgb(color.core);
export const BG_RGB = rgb(color.bg);
export const CYAN_RGB = CYAN;
export const GREY_HALO_RGB = rgb("#cfd6de");

import * as THREE from "three";
import type { NodeStatus, TileLayout } from "@/lib/graph";
import { activity, color } from "@/lib/theme/tokens";

/**
 * Builds the Dataland core as THREE geometry from the tile layout:
 *  - one instanced quad geometry: every glyph tile (hubs, entities, leaves,
 *    records, nucleus) in a single draw call; the tile shader draws the 1px
 *    outline, inner mark, depth echo and fill per instance
 *  - one LineSegments geometry: thin curved threads, alpha tapered toward
 *    their ends so they read as light, not wire
 *
 * Every instance / vertex carries its sector index so lighting a sector is a
 * single uniform change (no geometry rebuilds). Sector 7 = nucleus, -1 = never lit.
 */

export const CORE_SECTOR = 7;

const rgb = (hex: string) => new THREE.Color(hex).toArray() as [number, number, number];
const WHITE = rgb(activity.active);
const STATUS_RGB: Record<NodeStatus, [number, number, number]> = {
  idle: WHITE,
  ok: WHITE,
  attention: rgb(activity.attention),
  broken: rgb(activity.broken),
};
export const statusRgb = (s?: NodeStatus) => STATUS_RGB[s ?? "idle"];
export const statusHex = (s?: NodeStatus) =>
  s === "attention" ? activity.attention : s === "broken" ? activity.broken : activity.active;
/** ok = live / running: drawn as a solid white tile even at idle. */
const STATE_CODE: Record<NodeStatus, number> = { idle: 0, ok: 3, attention: 1, broken: 2 };

/** Quad padding (reference px) around each tile for the depth echo + glow. */
export const TILE_PAD = 5;

export interface CoreGeometry {
  tiles: THREE.InstancedBufferGeometry;
  threads: THREE.BufferGeometry;
  count: number;
}

export function buildCoreGeometry(layout: TileLayout): CoreGeometry {
  // --- tiles -----------------------------------------------------------------
  const n = layout.tiles.length;
  const center = new Float32Array(n * 2);
  const size = new Float32Array(n * 2);
  const meta = new Float32Array(n * 4); // sector, kind, state, variant
  const seed = new Float32Array(n);
  layout.tiles.forEach((t, i) => {
    center[i * 2] = t.x;
    center[i * 2 + 1] = -t.y; // y-down layout -> y-up WebGL
    size[i * 2] = t.w;
    size[i * 2 + 1] = t.h;
    meta[i * 4] = t.sector;
    meta[i * 4 + 1] = t.kind;
    meta[i * 4 + 2] = STATE_CODE[t.status];
    meta[i * 4 + 3] = t.variant;
    seed[i] = t.seed;
  });
  const quad = new THREE.PlaneGeometry(1, 1);
  const tiles = new THREE.InstancedBufferGeometry();
  tiles.index = quad.index;
  tiles.setAttribute("position", quad.getAttribute("position"));
  tiles.setAttribute("uv", quad.getAttribute("uv"));
  tiles.setAttribute("aCenter", new THREE.InstancedBufferAttribute(center, 2));
  tiles.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 2));
  tiles.setAttribute("aMeta", new THREE.InstancedBufferAttribute(meta, 4));
  tiles.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
  tiles.instanceCount = n;
  tiles.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);
  quad.dispose();

  // --- threads ---------------------------------------------------------------
  const pos: number[] = [];
  const alpha: number[] = [];
  const lit: number[] = [];
  const sector: number[] = [];
  const litColor: number[] = [];
  for (const th of layout.threads) {
    const c = statusRgb(th.status);
    const N = th.pts.length - 1;
    for (let i = 0; i < N; i++) {
      for (const j of [i, i + 1]) {
        const [x, y] = th.pts[j];
        // Taper: bright in the middle, fading into each end (a light streak).
        const taper = Math.pow(Math.sin((Math.PI * j) / N), 0.6);
        pos.push(x, -y, 0);
        alpha.push(th.alpha * (0.35 + 0.65 * taper));
        lit.push(Math.min(0.75, th.alpha * 4.2) * (0.3 + 0.7 * taper));
        sector.push(th.sector);
        litColor.push(c[0], c[1], c[2]);
      }
    }
  }
  const threads = new THREE.BufferGeometry();
  threads.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  threads.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alpha, 1));
  threads.setAttribute("aLitAlpha", new THREE.Float32BufferAttribute(lit, 1));
  threads.setAttribute("aSector", new THREE.Float32BufferAttribute(sector, 1));
  threads.setAttribute("aLitColor", new THREE.Float32BufferAttribute(litColor, 3));
  threads.computeBoundingSphere();

  return { tiles, threads, count: n };
}

export const BASE_RGB = rgb(color.core);
export const BG_RGB = rgb(color.bg);
export const WHITE_RGB = WHITE;
export const AMBER_RGB = rgb(activity.attention);
export const RED_RGB = rgb(activity.broken);
export const GREY_HALO_RGB = rgb("#bdbdbd");

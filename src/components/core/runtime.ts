import * as THREE from "three";
import { sampleTiles, type TileLayout } from "@/lib/graph";
import { activity } from "@/lib/theme/tokens";
import { AMBER_RGB, BASE_RGB, CORE_SECTOR, GREY_HALO_RGB, RED_RGB, TILE_PAD, WHITE_RGB, buildCoreGeometry } from "./geometry";
import { haloFragment, haloVertex, lineFragment, lineVertex, tileFragment, tileVertex } from "./shaders";

/**
 * Imperative three.js side of the core: owns geometry, materials, uniforms
 * and per-frame animation state. React only mounts `root` and calls
 * `update()` from useFrame, so nothing here re-renders React.
 *
 * Draw calls: halo plane, threads (one LineSegments), tiles (one instanced
 * mesh), plus a bracket per sector only while that sector needs attention.
 */

export interface CoreInputs {
  /** Index of the lit sector (-1 = none). */
  litIndex: number;
  voiceOn: boolean;
  speaking: boolean;
  /** Voice level 0..1 (already resolved by the caller). */
  level: number;
  reducedMotion: boolean;
  /** Per-sector attention (index = sector index): amber = waiting on Edward, red = broken. */
  attention: readonly SectorAttention[];
  /** Where the core sits (world units, y up) and its scale; home is {0, 0, 1}. */
  view: { x: number; y: number; scale: number };
}

export type SectorAttention = "attention" | "broken" | null;

const BREATH_PERIOD = 9; // seconds
const ATTN_PERIOD = 2.4; // slow enough to read as "waiting", not an alarm
const GLITCH_S = 0.2; // one-shot flicker on a state change
const ATTN_COLOR = { attention: new THREE.Color(activity.attention), broken: new THREE.Color(activity.broken) };

const v3 = (c: readonly number[]) => new THREE.Vector3(c[0], c[1], c[2]);
const damp = (x: number, t: number, k: number, dt: number) => x + (t - x) * (1 - Math.exp(-k * dt));

export class CoreRuntime {
  readonly root = new THREE.Group();
  /** True while a transition or glitch is in flight (caller runs full rate). */
  busy = true;

  private readonly disposables: { dispose(): void }[] = [];
  private readonly lit = { value: new Array(8).fill(0) as number[] };
  private readonly line: THREE.ShaderMaterial;
  private readonly tile: THREE.ShaderMaterial;
  private readonly halo: THREE.ShaderMaterial;
  /** One bracket per sector around its hub tile. */
  private readonly attn: { obj: THREE.LineSegments; mat: THREE.LineBasicMaterial; level: number; want: SectorAttention }[] = [];

  private s = { far: 1, vx: 0, vy: 0, vs: 1, lit: new Array(8).fill(0) as number[], mix: 0, radius: 70, opacity: 0.2, voice: 0, glitchAt: -10, attnKey: "" };

  constructor(layout: TileLayout = sampleTiles) {
    const geo = buildCoreGeometry(layout);
    const common = { transparent: true, depthTest: false, depthWrite: false };

    this.line = new THREE.ShaderMaterial({
      ...common,
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      uniforms: { uLit: this.lit, uBase: { value: v3(BASE_RGB) } },
    });
    this.tile = new THREE.ShaderMaterial({
      ...common,
      vertexShader: tileVertex,
      fragmentShader: tileFragment,
      uniforms: {
        uLit: this.lit,
        uBase: { value: v3(BASE_RGB) },
        uWhite: { value: v3(WHITE_RGB) },
        uAmber: { value: v3(AMBER_RGB) },
        uRed: { value: v3(RED_RGB) },
        uPx: { value: 1 },
        uPad: { value: TILE_PAD },
        uTime: { value: 0 },
        uGlitch: { value: 0 },
        uLevel: { value: 0 },
        uVoice: { value: 0 },
        uFar: { value: 1 },
      },
    });
    this.halo = new THREE.ShaderMaterial({
      ...common,
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: {
        uGrey: { value: v3(GREY_HALO_RGB) },
        uHot: { value: v3(WHITE_RGB) },
        uMix: { value: 0 },
        uRadius: { value: 70 },
        uOpacity: { value: 0.2 },
        uLevel: { value: 0 },
        uVoice: { value: 0 },
      },
    });

    const plane = new THREE.PlaneGeometry(1000, 1000);
    const add = <T extends THREE.Object3D>(o: T, order: number, visible = true): T => {
      o.renderOrder = order;
      o.frustumCulled = false;
      o.visible = visible;
      this.root.add(o);
      return o;
    };
    add(new THREE.Mesh(plane, this.halo), 0);
    add(new THREE.LineSegments(geo.threads, this.line), 1);
    add(new THREE.Mesh(geo.tiles, this.tile), 2);

    // Attention brackets: corner marks around each hub tile + a short tick toward the rim.
    for (const d of layout.districts) {
      const { x, y } = d.hub;
      const hx = d.hub.w / 2 + 7;
      const hy = d.hub.h / 2 + 6;
      const L = 6;
      const pts: number[] = [];
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          const cx = x + sx * hx;
          const cy = -(y + sy * hy);
          pts.push(cx, cy, 0, cx - sx * L, cy, 0, cx, cy, 0, cx, cy + sy * L, 0);
        }
      const ux = Math.cos(d.angle);
      const uy = -Math.sin(d.angle);
      const r0 = Math.hypot(x, y) + Math.hypot(hx, hy) + 4;
      pts.push(ux * r0, uy * r0, 0, ux * (r0 + 14), uy * (r0 + 14), 0);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ ...common, color: ATTN_COLOR.attention.clone(), opacity: 0 });
      this.attn.push({ obj: add(new THREE.LineSegments(g, mat), 3, false), mat, level: 0, want: null });
      this.disposables.push(g, mat);
    }

    this.disposables.push(geo.tiles, geo.threads, plane, this.line, this.tile, this.halo);
  }

  /** Advance one frame. `t` = elapsed seconds, `px` = device px per world unit. */
  update(inp: CoreInputs, t: number, delta: number, px: number): void {
    const S = this.s;
    const dt = Math.min(delta, 0.1);
    let moving = false;
    const step = (x: number, target: number, k = 6) => {
      const nx = inp.reducedMotion ? target : damp(x, target, k, dt);
      const done = Math.abs(nx - target) <= 1e-3;
      if (!done) moving = true;
      return done ? target : nx;
    };

    S.voice = step(S.voice, inp.voiceOn ? 1 : 0, 5);

    // Sector lighting (+ nucleus lights with any activity).
    const anyLit = inp.litIndex >= 0;
    for (let i = 0; i < CORE_SECTOR; i++) S.lit[i] = step(S.lit[i], i === inp.litIndex ? 1 : 0);
    S.lit[CORE_SECTOR] = step(S.lit[CORE_SECTOR], Math.max(anyLit ? 1 : 0, S.voice));
    for (let i = 0; i < 8; i++) this.lit.value[i] = S.lit[i];

    // Halo: faint grey breathing at idle, white bloom when active, voice-scaled when speaking.
    const active = anyLit || inp.voiceOn;
    S.mix = step(S.mix, active ? 1 : 0, 4);
    S.radius = step(S.radius, inp.voiceOn ? 230 : anyLit ? 110 : 70, 4);
    S.opacity = step(S.opacity, inp.voiceOn ? 0.5 : anyLit ? 0.22 : 0.16, 4);
    const breath = inp.reducedMotion ? 0.8 : 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_PERIOD));
    const hu = this.halo.uniforms;
    hu.uMix.value = S.mix;
    hu.uRadius.value = S.radius;
    hu.uOpacity.value = S.opacity * (breath + (1 - breath) * S.mix);
    hu.uLevel.value = inp.level;
    hu.uVoice.value = S.voice;

    // Glitch: one-shot on any attention change (never under reduced motion).
    const key = inp.attention.map((a) => a ?? "-").join(",");
    if (key !== S.attnKey) {
      if (S.attnKey && !inp.reducedMotion) S.glitchAt = t;
      S.attnKey = key;
    }
    const g = t - S.glitchAt;
    const glitch = g >= 0 && g < GLITCH_S ? 1 - g / GLITCH_S : 0;

    const tu = this.tile.uniforms;
    tu.uTime.value = t;
    tu.uGlitch.value = glitch;
    tu.uLevel.value = inp.level;
    tu.uVoice.value = S.voice;

    // Attention brackets: fade in/out, slow breathing pulse while present.
    const pulse = inp.reducedMotion ? 0.8 : 0.6 + 0.4 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / ATTN_PERIOD));
    this.attn.forEach((a, i) => {
      const want = inp.attention[i] ?? null;
      if (want) a.mat.color.copy(ATTN_COLOR[want]);
      a.level = step(a.level, want ? 1 : 0, 5);
      a.mat.opacity = a.level * 0.85 * pulse;
      a.obj.visible = a.mat.opacity > 0.003;
    });

    // View: slide/scale the whole core (Dev focus parks it beside the workspace).
    S.vx = step(S.vx, inp.view.x, 5);
    S.vy = step(S.vy, inp.view.y, 5);
    S.vs = step(S.vs, inp.view.scale, 5);
    this.root.position.set(S.vx, S.vy, 0);
    this.root.scale.set(S.vs, S.vs, 1);
    tu.uPx.value = px * S.vs;
    // The far field fades back when the core is parked (keeps rail labels clean).
    S.far = step(S.far, inp.view.scale < 0.99 ? 0.45 : 1, 4);
    tu.uFar.value = S.far;

    this.busy = moving || glitch > 0;
  }

  /** Mark a state change so the caller renders until it settles. */
  wake(): void {
    this.busy = true;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

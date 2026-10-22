import * as THREE from "three";
import type { BrainVisualGraph } from "@/lib/brain/visual";
import { RADII, type CoreLayout } from "@/lib/graph";
import { activity } from "@/lib/theme/tokens";
import { BASE_RGB, BG_RGB, CORE_SECTOR, CYAN_RGB, GREY_HALO_RGB, buildCoreGeometry } from "./geometry";
import { haloFragment, haloVertex, lineFragment, lineVertex, pointFragment, pointVertex } from "./shaders";

/**
 * Imperative three.js side of the core: owns geometry, materials, uniforms
 * and per-frame animation state. React only mounts `root` and calls
 * `update()` from useFrame, so nothing here re-renders React.
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
  /** Real brain energy 0..1, separate from voice level. */
  brainEnergy?: number;
  brainStatus?: "quiet" | "watch" | "approval" | "blocked";
}

export type SectorAttention = "attention" | "broken" | null;

const BREATH_PERIOD = 9; // seconds, from the wireframes
const RIPPLE_POOL = 4;
const RIPPLE_LIFE = 1.4;
const R0 = RADII.core * 2;
const ATTN_PERIOD = 2.4; // seconds; slow enough to read as "waiting", not an alarm
const ATTN_COLOR = { attention: new THREE.Color(activity.attention), broken: new THREE.Color(activity.broken) };

const v3 = (c: readonly number[]) => new THREE.Vector3(c[0], c[1], c[2]);
const damp = (x: number, t: number, k: number, dt: number) => x + (t - x) * (1 - Math.exp(-k * dt));

function toneForStatus(status: unknown): "dim" | "cyan" | "amber" | "red" {
  if (status === "blocked" || status === "down" || status === "unreachable" || status === "error" || status === "refused") return "red";
  if (status === "watch" || status === "approval" || status === "pending" || status === "auth_required" || status === "timeout" || status === "tls_error") return "amber";
  if (status === "ok" || status === "silent") return "cyan";
  return "dim";
}

function addNodeMark(push: (a: THREE.Vector3, b: THREE.Vector3) => void, p: THREE.Vector3, kind: string, importance: number) {
  const s = 2.4 + 5.5 * importance;
  const v = (x: number, y: number) => new THREE.Vector3(p.x + x, p.y + y, 0);
  if (kind === "domain") {
    push(v(-s, -s), v(s, -s));
    push(v(s, -s), v(s, s));
    push(v(s, s), v(-s, s));
    push(v(-s, s), v(-s, -s));
    return;
  }
  if (kind === "approval") {
    push(v(0, -s), v(s, 0));
    push(v(s, 0), v(0, s));
    push(v(0, s), v(-s, 0));
    push(v(-s, 0), v(0, -s));
    return;
  }
  if (kind === "vault") {
    push(v(-s, -s * 0.7), v(-s, s * 0.7));
    push(v(s, -s * 0.7), v(s, s * 0.7));
    push(v(-s, -s * 0.7), v(-s * 0.35, -s * 0.7));
    push(v(s * 0.35, s * 0.7), v(s, s * 0.7));
    return;
  }
  if (kind === "timeline") {
    push(v(-s * 0.6, 0), v(s * 0.6, 0));
    return;
  }
  push(v(-s, 0), v(s, 0));
  push(v(0, -s), v(0, s));
}

export class CoreRuntime {
  readonly root = new THREE.Group();
  /** True while a transition or ripple is in flight (caller runs full rate). */
  busy = true;

  private readonly disposables: { dispose(): void }[] = [];
  private readonly lit = { value: new Array(8).fill(0) as number[] };
  private readonly line: THREE.ShaderMaterial;
  private readonly point: THREE.ShaderMaterial;
  private readonly halo: THREE.ShaderMaterial;
  private readonly pulseMat: THREE.LineBasicMaterial;
  private readonly pulse: THREE.LineLoop;
  private readonly ripples: { obj: THREE.LineLoop; mat: THREE.LineBasicMaterial; start: number }[] = [];
  /** One attention bracket per sector: arc just outside the dial + faint inner-ring segment. */
  private readonly attn: { obj: THREE.LineSegments; mat: THREE.LineBasicMaterial; level: number }[] = [];
  private readonly visualGroup = new THREE.Group();
  private visualDisposables: { dispose(): void }[] = [];

  private s = { vx: 0, vy: 0, vs: 1, lit: new Array(8).fill(0) as number[], mix: 0, radius: 78, opacity: 0.32, voice: 0, brain: 0, prevLevel: 0, lastRipple: -10, next: 0 };

  constructor(layout: CoreLayout) {
    const geo = buildCoreGeometry(layout);
    const common = { transparent: true, depthTest: false, depthWrite: false };

    this.line = new THREE.ShaderMaterial({
      ...common,
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      uniforms: { uLit: this.lit, uBase: { value: v3(BASE_RGB) } },
    });
    this.point = new THREE.ShaderMaterial({
      ...common,
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      uniforms: { uLit: this.lit, uBase: { value: v3(BASE_RGB) }, uBg: { value: v3(BG_RGB) }, uPx: { value: 1 } },
    });
    this.halo = new THREE.ShaderMaterial({
      ...common,
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: {
        uGrey: { value: v3(GREY_HALO_RGB) },
        uCyan: { value: v3(CYAN_RGB) },
        uMix: { value: 0 },
        uRadius: { value: 78 },
        uOpacity: { value: 0.32 },
        uLevel: { value: 0 },
        uVoice: { value: 0 },
      },
    });
    this.pulseMat = new THREE.LineBasicMaterial({ ...common, color: new THREE.Color().fromArray(CYAN_RGB), opacity: 0 });

    const circlePts: THREE.Vector3[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      circlePts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const circle = new THREE.BufferGeometry().setFromPoints(circlePts);
    const plane = new THREE.PlaneGeometry(1000, 1000);

    const add = <T extends THREE.Object3D>(o: T, order: number, visible = true): T => {
      o.renderOrder = order;
      o.frustumCulled = false;
      o.visible = visible;
      this.root.add(o);
      return o;
    };
    add(new THREE.Mesh(plane, this.halo), 0);
    add(new THREE.Mesh(geo.wedges, this.line), 1);
    this.pulse = add(new THREE.LineLoop(circle, this.pulseMat), 2, false);
    for (let i = 0; i < RIPPLE_POOL; i++) {
      const mat = this.pulseMat.clone();
      this.ripples.push({ obj: add(new THREE.LineLoop(circle, mat), 2, false), mat, start: -10 });
      this.disposables.push(mat);
    }
    add(new THREE.LineSegments(geo.lines, this.line), 3);
    add(new THREE.Points(geo.points, this.point), 4);

    this.visualGroup.renderOrder = 2;
    this.visualGroup.frustumCulled = false;
    this.root.add(this.visualGroup);

    for (const sec of layout.sectors) {
      const pts: number[] = [];
      const arc = (r: number, a1: number, a2: number) => {
        const steps = Math.ceil(((a2 - a1) * r) / 4);
        for (let i = 0; i < steps; i++) {
          const t1 = a1 + ((a2 - a1) * i) / steps;
          const t2 = a1 + ((a2 - a1) * (i + 1)) / steps;
          pts.push(r * Math.cos(t1), -r * Math.sin(t1), 0, r * Math.cos(t2), -r * Math.sin(t2), 0);
        }
      };
      const ro = RADII.dial + 12;
      const a1 = sec.start + 0.03;
      const a2 = sec.end - 0.03;
      arc(ro, a1, a2);
      arc(ro + 2.5, a1 + 0.06, a2 - 0.06);
      for (const a of [a1, a2]) pts.push(ro * Math.cos(a), -ro * Math.sin(a), 0, (ro - 6) * Math.cos(a), -(ro - 6) * Math.sin(a), 0);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ ...common, color: ATTN_COLOR.attention.clone(), opacity: 0 });
      this.attn.push({ obj: add(new THREE.LineSegments(g, mat), 5, false), mat, level: 0 });
      this.disposables.push(g, mat);
    }

    this.disposables.push(geo.lines, geo.wedges, geo.points, circle, plane, this.line, this.point, this.halo, this.pulseMat);
  }

  setVisualGraph(graph: BrainVisualGraph | null, layout: CoreLayout, selectedNodeId?: string): void {
    this.visualGroup.clear();
    this.visualDisposables.forEach((item) => item.dispose());
    this.visualDisposables = [];
    if (!graph || graph.nodes.length === 0) return;

    const positions = new Map<string, THREE.Vector3>();
    const domainAngles = new Map(layout.sectors.map((sector) => [sector.domain, (sector.start + sector.end) / 2]));
    const domainCounts = new Map<string, number>();
    graph.nodes.forEach((node, index) => {
      const base = domainAngles.get(node.domain as never) ?? (index / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      const count = domainCounts.get(node.domain) ?? 0;
      domainCounts.set(node.domain, count + 1);
      const local = (count - 1.5) * 0.08;
      const radius = node.kind === "domain" ? RADII.core * 1.28 : RADII.core * (1.58 + 0.42 * node.importance + 0.06 * count);
      positions.set(node.id, new THREE.Vector3(radius * Math.cos(base + local), -radius * Math.sin(base + local), 0));
    });

    const groups: Record<"dim" | "cyan" | "amber" | "red", number[]> = { dim: [], cyan: [], amber: [], red: [] };
    const push = (tone: keyof typeof groups, a: THREE.Vector3, b: THREE.Vector3) => groups[tone].push(a.x, a.y, 0, b.x, b.y, 0);
    for (const edge of graph.edges) {
      const a = positions.get(edge.from);
      const b = positions.get(edge.to);
      if (!a || !b) continue;
      const target = graph.nodes.find((node) => node.id === edge.to);
      push(edge.from === selectedNodeId || edge.to === selectedNodeId ? "cyan" : toneForStatus(target?.status), a, b);
    }
    for (const node of graph.nodes) {
      const p = positions.get(node.id);
      if (!p) continue;
      addNodeMark((a, b) => push(node.id === selectedNodeId ? "cyan" : toneForStatus(node.status), a, b), p, node.kind, node.id === selectedNodeId ? 1 : node.importance);
    }

    const specs: Array<[keyof typeof groups, string, number]> = [
      ["dim", "#6f7f86", 0.12],
      ["cyan", activity.active, 0.24],
      ["amber", activity.attention, 0.34],
      ["red", activity.broken, 0.42],
    ];
    for (const [tone, color, opacity] of specs) {
      if (!groups[tone].length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(groups[tone], 3));
      const material = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, color: new THREE.Color(color), opacity });
      const lines = new THREE.LineSegments(geometry, material);
      lines.renderOrder = 2;
      lines.frustumCulled = false;
      this.visualGroup.add(lines);
      this.visualDisposables.push(geometry, material);
    }
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
    S.brain = step(S.brain, inp.brainEnergy ?? 0.08, 2.4);

    // Sector lighting (+ core glyph lights with any activity).
    const anyLit = inp.litIndex >= 0;
    for (let i = 0; i < CORE_SECTOR; i++) S.lit[i] = step(S.lit[i], i === inp.litIndex ? 1 : 0);
    S.lit[CORE_SECTOR] = step(S.lit[CORE_SECTOR], Math.max(anyLit ? 1 : 0, S.voice));
    for (let i = 0; i < 8; i++) this.lit.value[i] = S.lit[i];

    // Halo: grey + 9s breathing at idle, cyan when active, voice-scaled (uLevel) when speaking.
    const active = anyLit || inp.voiceOn || S.brain > 0.16;
    S.mix = step(S.mix, active ? Math.max(0.22, S.brain) : 0, 4);
    S.radius = step(S.radius, inp.voiceOn ? 190 : anyLit ? 96 : 78 + 28 * S.brain, 4);
    S.opacity = step(S.opacity, inp.voiceOn ? 0.85 : 0.26 + 0.32 * S.brain, 4);
    const breath = inp.reducedMotion ? 0.8 : 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_PERIOD));
    const hu = this.halo.uniforms;
    hu.uMix.value = S.mix;
    hu.uRadius.value = S.radius;
    hu.uOpacity.value = S.opacity * (breath + (1 - breath) * Math.max(S.mix, S.brain));
    hu.uLevel.value = inp.level;
    hu.uVoice.value = S.voice;


    // Pulse ring follows the level.
    const r = R0 * (1 + 0.7 * inp.level);
    this.pulse.scale.set(r, r, 1);
    this.pulseMat.opacity = (0.35 + 0.6 * inp.level) * (inp.speaking ? 1 : 0) * S.voice;
    this.pulse.visible = this.pulseMat.opacity > 0.002;

    // Ripples spawn on peaks (never under reduced motion).
    if (inp.speaking && !inp.reducedMotion && inp.level > 0.62 && S.prevLevel <= 0.62 && t - S.lastRipple > 0.28) {
      this.ripples[S.next].start = t;
      S.next = (S.next + 1) % RIPPLE_POOL;
      S.lastRipple = t;
    }
    S.prevLevel = inp.level;
    let rippling = false;
    for (const rp of this.ripples) {
      const age = (t - rp.start) / RIPPLE_LIFE;
      if (age < 0 || age >= 1) {
        rp.obj.visible = false;
        continue;
      }
      rippling = true;
      const e = 1 - Math.pow(1 - age, 3);
      const rr = R0 + (RADII.dial + 24 - R0) * e;
      rp.obj.scale.set(rr, rr, 1);
      rp.mat.opacity = 0.45 * (1 - e);
      rp.obj.visible = true;
    }

    // Attention brackets: fade in/out, slow breathing pulse while present.
    const pulse = inp.reducedMotion ? 0.75 : 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / ATTN_PERIOD));
    this.attn.forEach((a, i) => {
      const want = inp.attention[i] ?? null;
      if (want) a.mat.color.copy(ATTN_COLOR[want]);
      a.level = step(a.level, want ? 1 : 0, 5);
      a.mat.opacity = a.level * 0.8 * pulse;
      a.obj.visible = a.mat.opacity > 0.003;
    });

    // View: slide/scale the whole core (Dev focus parks it beside the workspace).
    S.vx = step(S.vx, inp.view.x, 5);
    S.vy = step(S.vy, inp.view.y, 5);
    S.vs = step(S.vs, inp.view.scale, 5);
    this.root.position.set(S.vx, S.vy, 0);
    this.root.scale.set(S.vs, S.vs, 1);
    this.point.uniforms.uPx.value = px * S.vs;

    this.busy = moving || rippling;
  }

  /** Mark a state change so the caller renders until it settles. */
  wake(): void {
    this.busy = true;
  }

  dispose(): void {
    this.visualDisposables.forEach((item) => item.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}

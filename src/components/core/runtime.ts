import * as THREE from "three";
import { RADII, type CoreLayout } from "@/lib/graph";
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
}

const BREATH_PERIOD = 9; // seconds, from the wireframes
const RIPPLE_POOL = 4;
const RIPPLE_LIFE = 1.4;
const R0 = RADII.core * 2;

const v3 = (c: readonly number[]) => new THREE.Vector3(c[0], c[1], c[2]);
const damp = (x: number, t: number, k: number, dt: number) => x + (t - x) * (1 - Math.exp(-k * dt));

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

  private s = { lit: new Array(8).fill(0) as number[], mix: 0, radius: 78, opacity: 0.32, voice: 0, prevLevel: 0, lastRipple: -10, next: 0 };

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

    this.disposables.push(geo.lines, geo.wedges, geo.points, circle, plane, this.line, this.point, this.halo, this.pulseMat);
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

    // Sector lighting (+ core glyph lights with any activity).
    const anyLit = inp.litIndex >= 0;
    for (let i = 0; i < CORE_SECTOR; i++) S.lit[i] = step(S.lit[i], i === inp.litIndex ? 1 : 0);
    S.lit[CORE_SECTOR] = step(S.lit[CORE_SECTOR], Math.max(anyLit ? 1 : 0, S.voice));
    for (let i = 0; i < 8; i++) this.lit.value[i] = S.lit[i];

    // Halo: grey + 9s breathing at idle, cyan when active, voice-scaled (uLevel) when speaking.
    const active = anyLit || inp.voiceOn;
    S.mix = step(S.mix, active ? 1 : 0, 4);
    S.radius = step(S.radius, inp.voiceOn ? 190 : anyLit ? 96 : 78, 4);
    S.opacity = step(S.opacity, inp.voiceOn ? 0.85 : 0.32, 4);
    const breath = inp.reducedMotion ? 0.8 : 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_PERIOD));
    const hu = this.halo.uniforms;
    hu.uMix.value = S.mix;
    hu.uRadius.value = S.radius;
    hu.uOpacity.value = S.opacity * (breath + (1 - breath) * S.mix);
    hu.uLevel.value = inp.level;
    hu.uVoice.value = S.voice;

    this.point.uniforms.uPx.value = px;

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

    this.busy = moving || rippling;
  }

  /** Mark a state change so the caller renders until it settles. */
  wake(): void {
    this.busy = true;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

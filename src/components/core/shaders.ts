/**
 * Shaders for the Dataland core. The thread (line) material and the tile
 * material read the same per-sector `uLit[8]` uniform; the halo and tiles
 * read `uLevel` (voice RMS 0..1), so voice glow stays one uniform write per frame.
 */

export const lineVertex = /* glsl */ `
  attribute float aAlpha;
  attribute float aLitAlpha;
  attribute float aSector;
  attribute vec3 aLitColor;
  uniform float uLit[8];
  uniform vec3 uBase;
  varying vec4 vColor;
  void main() {
    float lit = aSector < -0.5 ? 0.0 : uLit[int(aSector + 0.5)];
    vec3 c = mix(uBase, aLitColor, lit);
    float a = mix(aAlpha, max(aAlpha, aLitAlpha), lit);
    vColor = vec4(c, a);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const lineFragment = /* glsl */ `
  varying vec4 vColor;
  void main() {
    if (vColor.a < 0.002) discard;
    gl_FragColor = vColor;
  }
`;

/**
 * Glyph tile (instanced quad). Draws, per instance: a 1-device-px outline,
 * a faint depth echo offset up-right (the stacked "data city" read), an
 * inner mark (notch / square / bars), a white fill when its sector is lit
 * and the tile is "active", and an amber notch (attention) or red outline
 * (broken). uLevel brightens a wave of tiles out from the nucleus while
 * speaking; uGlitch briefly shears horizontal bands on a state change.
 */
export const tileVertex = /* glsl */ `
  attribute vec2 aCenter;
  attribute vec2 aSize;
  attribute vec4 aMeta;
  attribute float aSeed;
  uniform float uLit[8];
  uniform float uTime;
  uniform float uGlitch;
  uniform float uLevel;
  uniform float uVoice;
  uniform float uPad;
  varying vec2 vLocal;
  varying vec2 vHalf;
  varying float vLit;
  varying vec4 vMeta;
  varying float vSeed;
  varying float vWave;
  void main() {
    float s = aMeta.x;
    vLit = s < -0.5 ? 0.0 : uLit[int(s + 0.5)];
    vHalf = aSize * 0.5;
    vec2 ext = vHalf + vec2(uPad);
    vLocal = position.xy * 2.0 * ext;
    vec2 c = aCenter;
    float band = floor((c.y + 400.0) / 16.0);
    float j = fract(sin(band * 12.9898 + floor(uTime * 45.0) * 78.233) * 43758.5453);
    c.x += uGlitch * (j - 0.5) * 16.0 * step(0.5, j);
    float r = length(aCenter);
    vWave = uVoice * uLevel * (exp(-pow((r - (30.0 + 210.0 * uLevel)) / 55.0, 2.0)) + 0.35 * exp(-r / 110.0));
    vMeta = aMeta;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(c + vLocal, 0.0, 1.0);
  }
`;

export const tileFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uWhite;
  uniform vec3 uAmber;
  uniform vec3 uRed;
  uniform float uPx;
  uniform float uGlitch;
  uniform float uFar;
  varying vec2 vLocal;
  varying vec2 vHalf;
  varying float vLit;
  varying vec4 vMeta;
  varying float vSeed;
  varying float vWave;

  float sdBox(vec2 p, vec2 h) { vec2 d = abs(p) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  vec4 over(vec4 acc, vec3 c, float a) { return acc * (1.0 - a) + vec4(c * a, a); }

  void main() {
    float aa = 1.0 / uPx;
    float kind = vMeta.y;
    float state = vMeta.z;
    float variant = vMeta.w;
    vec2 p = vLocal;
    float d = sdBox(p, vHalf);
    float stroke = 1.0 - smoothstep(aa * 0.5, aa * 1.5, abs(d));
    float inside = 1.0 - smoothstep(-aa * 0.5, aa * 0.5, d);
    vec2 q = p / max(vHalf, vec2(0.001));

    float wave = clamp(vWave, 0.0, 1.0);
    float lit = vLit;
    float hot = max(lit, wave * 1.6);
    float live = step(2.5, state);
    vec3 col = mix(uBase, uWhite, clamp(max(hot, live), 0.0, 1.0));
    float baseA = kind < 0.5 ? 0.66 : kind < 1.5 ? 0.5 : kind < 2.5 ? 0.38 : kind < 3.5 ? 0.28 : kind < 4.5 ? 0.55 : (0.022 + 0.018 * variant) * uFar;
    float a = clamp(mix(baseA, kind < 2.5 ? 0.95 : 0.7, lit) + wave * (kind > 4.5 ? 0.25 : 0.7), 0.0, 1.0);
    a = max(a, live * 0.85);

    float fillAmt = 0.0;
    if (kind > 3.5) fillAmt = step(1.5, variant) * clamp(max(lit, wave * 3.0), 0.0, 1.0);
    else if (kind > 2.5) fillAmt = kind > 4.5 ? step(0.8, vSeed) : 1.0;
    else if (kind > 0.5 && kind < 1.5) fillAmt = lit * step(0.5, vSeed);
    else if (kind > 1.5) fillAmt = lit * step(0.82, vSeed);
    fillAmt = max(fillAmt, live);

    float mark = 0.0;
    if (kind < 2.5) {
      if (variant > 0.5 && variant < 1.5) mark = step(-0.8, q.x) * step(q.x, 0.15) * step(abs(q.y + 0.5), 0.2);
      else if (variant > 1.5 && variant < 2.5) mark = step(max(abs(q.x), abs(q.y)), 0.34);
      else if (variant > 2.5) mark = step(abs(q.y), 0.2) * step(abs(abs(q.x) - 0.42), 0.16);
      mark *= step(3.5, vHalf.x);
    }

    vec4 acc = vec4(0.0);
    // Depth echo (entities / leaves / hubs only).
    if (kind < 2.5) {
      float d2 = sdBox(p - vec2(2.5, 2.5), vHalf);
      float echo = (1.0 - smoothstep(aa * 0.5, aa * 1.5, abs(d2))) * (1.0 - inside);
      acc = over(acc, col, echo * a * 0.28);
    }
    // Fill.
    acc = over(acc, col, inside * fillAmt * a);
    // Outline (broken = red and always visible).
    float broken = step(1.5, state) * (1.0 - live);
    vec3 oc = mix(col, uRed, broken);
    float oa = mix(a, max(a, 0.9), broken);
    acc = over(acc, oc, stroke * oa);
    // Inner mark: dark on a filled tile, light on a hollow one.
    vec3 mc = mix(col, vec3(0.0), fillAmt);
    acc = over(acc, mc, mark * inside * mix(a * 0.75, 1.0, fillAmt));
    // Attention / broken notch just under the tile.
    float flagged = step(0.5, state) * (1.0 - live);
    float notch = flagged * step(-vHalf.x, p.x) * step(p.x, -vHalf.x + max(4.0, vHalf.x * 1.1)) * step(abs(p.y + vHalf.y + 2.2), 0.8);
    acc = over(acc, mix(uAmber, uRed, broken), notch * 0.95);
    // Glitch: a red fringe on some tiles for the flicker.
    acc.rgb = mix(acc.rgb, uRed * acc.a, uGlitch * 0.45 * step(0.7, vSeed));

    if (acc.a < 0.003) discard;
    gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
  }
`;

export const haloVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Radial halo: a soft white bloom. Grey (idle, breathing) and white (active)
 * stops; uLevel (voice RMS) scales radius + opacity when uVoice is on.
 */
export const haloFragment = /* glsl */ `
  uniform vec3 uGrey;
  uniform vec3 uHot;
  uniform float uMix;
  uniform float uRadius;
  uniform float uOpacity;
  uniform float uLevel;
  uniform float uVoice;
  varying vec2 vPos;

  float grad(float t, vec4 st, vec4 al) {
    if (t <= st.y) return mix(al.x, al.y, t / st.y);
    if (t <= st.z) return mix(al.y, al.z, (t - st.y) / (st.z - st.y));
    return mix(al.z, al.w, clamp((t - st.z) / (1.0 - st.z), 0.0, 1.0));
  }

  void main() {
    float scale = mix(1.0, 0.82 + 0.45 * uLevel, uVoice);
    float t = length(vPos) / (uRadius * scale);
    if (t >= 1.0) discard;
    float g = grad(t, vec4(0.0, 0.22, 0.6, 1.0), vec4(0.55, 0.16, 0.03, 0.0));
    float c = grad(t, vec4(0.0, 0.18, 0.55, 1.0), vec4(0.7, 0.26, 0.06, 0.0));
    float a = mix(g, c, uMix) * uOpacity * mix(1.0, 0.45 + 0.55 * uLevel, uVoice);
    gl_FragColor = vec4(mix(uGrey, uHot, uMix), a);
  }
`;

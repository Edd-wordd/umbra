/**
 * Shaders for the system core. One line/wedge material and one point material
 * read the same per-sector `uLit[8]` uniform; one halo material reads
 * `uLevel` (voice RMS 0..1) so voice glow is a single uniform write per frame.
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

/** Point sprite size in reference px (must cover the largest glyph + glow). */
export const POINT_SIZE = 28.0;

export const pointVertex = /* glsl */ `
  attribute float aAlpha;
  attribute float aSector;
  attribute float aTier;
  attribute vec3 aLitColor;
  uniform float uLit[8];
  uniform float uPx;
  varying float vAlpha;
  varying float vLit;
  varying float vTier;
  varying vec3 vLitColor;
  void main() {
    vLit = aSector < -0.5 ? 0.0 : uLit[int(aSector + 0.5)];
    vAlpha = aAlpha;
    vTier = aTier;
    vLitColor = aLitColor;
    gl_PointSize = ${POINT_SIZE.toFixed(1)} * uPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const pointFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uBg;
  uniform float uPx;
  varying float vAlpha;
  varying float vLit;
  varying float vTier;
  varying vec3 vLitColor;

  float fill(float d, float r, float aa) { return 1.0 - smoothstep(r - aa * 0.5, r + aa * 0.5, d); }
  float ring(float d, float r, float aa) { return 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa * 0.5, abs(d - r)); }

  void main() {
    vec2 p = (gl_PointCoord - 0.5) * ${POINT_SIZE.toFixed(1)};
    float aa = 1.0 / uPx;
    float len = length(p);
    vec3 col = mix(uBase, vLitColor, vLit);
    float a = mix(vAlpha, 1.0, vLit);

    float inside; float stroke;
    if (vTier < 0.5) {
      // Hub: 9px square rotated 45deg (outline, bg fill) + center dot.
      float d = (abs(p.x) + abs(p.y)) * 0.70710678;
      inside = fill(d, 4.5, aa);
      stroke = max(ring(d, 4.5, aa), fill(len, 1.6, aa));
    } else if (vTier < 2.5) {
      // Leaf: outline circle at idle, filled when lit.
      float r = vTier < 1.5 ? 2.8 : 1.9;
      inside = fill(len, r + 0.5 * vLit, aa);
      stroke = max(ring(len, r, aa), vLit * inside);
    } else {
      // Core dot.
      inside = fill(len, 3.2, aa);
      stroke = inside;
    }

    float shapeA = a * max(inside, stroke);
    vec3 shapeC = mix(uBg, col, stroke);

    // Soft activity glow, only when lit.
    float glowA = vLit * 0.55 * exp(-pow(len / (vTier > 2.5 ? 7.0 : 4.5), 2.0));
    float outA = max(shapeA, glowA);
    if (outA < 0.003) discard;
    vec3 outC = mix(col, shapeC, shapeA / outA);
    gl_FragColor = vec4(outC, outA);
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
 * Radial halo. Grey (idle, breathing) and cyan (active) gradient stops come
 * from the locked wireframes. uLevel (voice RMS) scales radius + opacity when
 * uVoice is on.
 */
export const haloFragment = /* glsl */ `
  uniform vec3 uGrey;
  uniform vec3 uCyan;
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
    gl_FragColor = vec4(mix(uGrey, uCyan, uMix), a);
  }
`;

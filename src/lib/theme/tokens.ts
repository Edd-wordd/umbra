/**
 * JS mirror of the CSS design tokens in src/app/globals.css, for places that
 * cannot read CSS variables (WebGL shaders). Keep both in sync.
 */
export const color = {
  bg: "#060708",
  panel: "#08090b",
  line: "#1d2024",
  ghost: "#2a2e33",
  dim: "#4a5058",
  mid: "#7d848c",
  ink: "#aab1b9",
  core: "#9aa3ad",
  cyan: "#3fe3ff",
  amber: "#ffb648",
  red: "#ff5252",
} as const;

/** Activity palette: color only ever encodes state. */
export const activity = {
  active: color.cyan,
  attention: color.amber,
  broken: color.red,
} as const;

/** Reference frame for the locked wireframes; layout coordinates use it. */
export const FRAME = { width: 1920, height: 1080 } as const;

/**
 * JS mirror of the CSS design tokens in src/app/globals.css, for places that
 * cannot read CSS variables (WebGL shaders). Keep both in sync.
 * "Dataland" system: black, white, grays; red = broken; amber = needs you.
 */
export const color = {
  bg: "#000000",
  panel: "#000000",
  line: "#1c1c1c",
  ghost: "#3d3d3d",
  dim: "#5c5c5c",
  mid: "#8f8f8f",
  ink: "#d4d4d4",
  core: "#b8b8b8",
  white: "#f5f5f5",
  amber: "#d6a248",
  red: "#ff3b30",
} as const;

/** Activity palette: white = active, amber = needs you, red = broken. */
export const activity = {
  active: color.white,
  attention: color.amber,
  broken: color.red,
} as const;

/** Reference frame for the locked wireframes; layout coordinates use it. */
export const FRAME = { width: 1920, height: 1080 } as const;

import { FRAME } from "@/lib/theme/tokens";

/**
 * Geometry of the Dev focus workspace, shared by the DOM panel and the core
 * (which slides right and shrinks so the brain stays visible beside it).
 * All values are CSS px.
 */
export const DEV_FOCUS = {
  left: 100,
  top: 104,
  bottom: 84,
  maxWidth: 1060,
  /** Below this the core gets squeezed rather than the workspace. */
  minWidth: 860,
  /** Room kept on the right for the mini core + right rails. */
  reserve: 500,
  /** Right rails' footprint. */
  railGutter: 110,
  /** Slim left column shown by default; the right panel slides open on selection. */
  slim: 470,
} as const;

const { left, reserve, minWidth, maxWidth } = DEV_FOCUS;

export const devFocusWidthCss = `min(clamp(${minWidth}px, calc(100vw - ${left + reserve}px), ${maxWidth}px), calc(100vw - ${left + 40}px))`;

/** JS mirror of devFocusWidthCss. */
export function devFocusWidth(vw: number): number {
  return Math.min(Math.max(minWidth, Math.min(maxWidth, vw - left - reserve)), vw - left - 40);
}

export interface CoreView {
  /** World-unit offset (1 unit = 1 px of the 1920x1080 frame), y up. */
  x: number;
  y: number;
  scale: number;
}

export const CORE_HOME: CoreView = { x: 0, y: 0, scale: 1 };

/**
 * Where the core sits while the Dev focus is open: centered in the free strip
 * right of the slim column (large), or right of the full panel once the
 * detail panel has slid open (small).
 */
export function coreFocusView(vw: number, vh: number, open = true): CoreView {
  const zoom = Math.min(vw / FRAME.width, vh / FRAME.height);
  const from = DEV_FOCUS.left + (open ? devFocusWidth(vw) : DEV_FOCUS.slim);
  const to = vw - DEV_FOCUS.railGutter;
  const cx = (from + to) / 2;
  const cy = (DEV_FOCUS.top + vh - DEV_FOCUS.bottom) / 2;
  // Structure + rim labels radius ~ 290 frame px.
  const fit = (to - from - 48) / (2 * 290 * zoom);
  const scale = Math.max(0.3, Math.min(open ? 0.62 : 0.86, fit));
  return { x: (cx - vw / 2) / zoom, y: -(cy - vh / 2) / zoom, scale };
}

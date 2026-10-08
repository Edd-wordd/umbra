import type { AstroSnapshot } from "./types";

export function createSampleAstroSnapshot(now = Date.now()): AstroSnapshot {
  return {
    devices: [
      { id: "device:astro:pi-indi", label: "Astro Pi · INDI", kind: "pi", status: "connected" },
      { id: "device:mount:onstep", label: "OnStep Mount", kind: "mount", status: "unknown" },
      { id: "device:camera:sony-a7ii", label: "Sony A7 II", kind: "camera", status: "unknown" },
    ],
    targets: [
      { id: "target:astro:m31", label: "M31", status: "visible", bestAt: now + 2 * 60 * 60_000, altitude: 48 },
      { id: "target:astro:m42", label: "M42", status: "upcoming", bestAt: now + 5 * 60 * 60_000, altitude: 22 },
    ],
    sessions: [
      {
        id: "astro-session:m31-2026-10-05",
        targetId: "target:astro:m31",
        title: "M31 · 2026-10-05",
        status: "imported",
        capturedAt: now - 2 * 24 * 60 * 60_000,
        lights: 120,
        darks: 30,
        flats: 30,
        bias: 50,
        imageSetId: "imageset:astro:m31-2026-10-05",
      },
    ],
  };
}

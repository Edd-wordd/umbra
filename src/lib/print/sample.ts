import type { PrintSnapshot } from "./types";

export function createSamplePrintSnapshot(now = Date.now()): PrintSnapshot {
  return {
    device: {
      id: "device:printer:canon-pro-1000",
      label: "Canon PRO-1000",
      model: "Canon imagePROGRAF PRO-1000",
      status: "ready",
      queue: "clear",
      paper: "unknown",
      profile: "unknown",
    },
    jobs: [
      {
        id: "printjob:m42-final-17x22",
        title: "M42 final · 17x22",
        status: "recent",
        paper: "Canon Pro Luster",
        profile: "PRO-1000 Luster",
        printedAt: now - 5 * 24 * 60 * 60_000,
      },
      {
        id: "printjob:m31-proof-staged",
        title: "M31 proof export",
        status: "staged",
        source: "imageset:astro:m31-2026-10-05",
        paper: "needs confirm",
        profile: "needs confirm",
      },
    ],
    imageSets: [
      {
        id: "imageset:astro:m31-2026-10-05",
        title: "M31 astro session · stacked TIFF",
        sourceSession: "astro-session:m31-2026-10-05",
        status: "print_ready",
        files: 1,
      },
    ],
  };
}

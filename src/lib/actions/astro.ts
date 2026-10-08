import type { UmbraAction } from "./types";

export const ASTRO_ACTIONS: UmbraAction[] = [
  {
    id: "astro.session.plan",
    label: "Prepare astro session plan",
    description: "Prepare target, gear, capture, and calibration checklist without moving hardware.",
    domain: "astro",
    risk: "prepare",
    dryRun: (ctx) => ({
      summary: "Prepare astro session plan",
      target: String(ctx.args?.entityId ?? "selected target"),
      expectedResult: "A session plan/checklist is prepared; no hardware moves.",
    }),
    execute: () => ({ ok: false, message: "astro.session.plan is not wired to session planner yet" }),
  },
  {
    id: "astro.devices.check",
    label: "Check astro gear",
    description: "Check INDI, mount, and camera readiness.",
    domain: "astro",
    risk: "read",
    dryRun: () => ({ summary: "Check astro gear", expectedResult: "INDI/mount/camera readiness is refreshed." }),
    execute: () => ({ ok: false, message: "astro.devices.check is not wired to INDI/OnStep bridge yet" }),
    approvalPolicy: "none",
  },
  {
    id: "astro.session.import",
    label: "Import astro session",
    description: "Import captured session images into the processing pipeline.",
    domain: "astro",
    risk: "prepare",
    dryRun: (ctx) => ({
      summary: "Import astro session",
      target: String(ctx.args?.sessionId ?? "selected astro session"),
      expectedResult: "Captured images are gathered for stacking/processing; originals remain untouched.",
    }),
    execute: () => ({ ok: false, message: "astro.session.import is not wired to filesystem bridge yet" }),
  },
];

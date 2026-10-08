import type { UmbraAction } from "./types";

export const CAMERAS_ACTIONS: UmbraAction[] = [
  {
    id: "cameras.stream.open",
    label: "Open camera stream",
    description: "Open a camera stream or source UI.",
    domain: "cameras",
    risk: "read",
    dryRun: (ctx) => ({ summary: "Open camera stream", target: String(ctx.args?.entityId ?? "selected camera"), expectedResult: "Camera stream/source opens." }),
    execute: () => ({ ok: true, message: "camera stream open prepared; browser/player execution comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "cameras.snapshot.take",
    label: "Take snapshot",
    description: "Take a still snapshot from a camera stream.",
    domain: "cameras",
    risk: "read",
    dryRun: (ctx) => ({ summary: "Take camera snapshot", target: String(ctx.args?.entityId ?? "selected camera"), expectedResult: "A still snapshot is saved for review/incident use." }),
    execute: () => ({ ok: false, message: "cameras.snapshot.take is not wired to camera bridge yet" }),
    approvalPolicy: "none",
  },
  {
    id: "cameras.service.restart",
    label: "Restart camera service",
    description: "Prepare a restart for a camera/NVR service.",
    domain: "cameras",
    risk: "local-risky",
    dryRun: (ctx) => ({
      summary: "Restart camera service",
      target: String(ctx.args?.entityId ?? "selected camera/service"),
      expectedResult: "Camera or NVR service restarts and stream health is rechecked.",
      rollbackHint: "Restart again or inspect Lab/NVR service if it does not recover.",
      warnings: ["Restart may interrupt recording."],
    }),
    execute: () => ({ ok: false, message: "cameras.service.restart is not wired to NVR/camera bridge yet" }),
  },
];

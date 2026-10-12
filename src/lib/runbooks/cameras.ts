import type { Runbook } from "./types";

export const CAMERAS_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:cameras:offline",
    title: "Camera Offline Triage",
    domain: "cameras",
    description: "Check camera stream/source health and link camera issues to Lab/NVR/network services.",
    triggers: ["camera_offline", "stream_unreachable"],
    risk: "local-risky",
    steps: [
      { id: "open", title: "Open stream/source", actionId: "cameras.stream.open" },
      { id: "snapshot", title: "Attempt snapshot", actionId: "cameras.snapshot.take" },
      { id: "lab", title: "Check related Lab/NVR service" },
      { id: "restart", title: "Restart service after approval", actionId: "cameras.service.restart", requiresApproval: true },
    ],
    successCriteria: ["Stream is online", "Issue is linked to camera, NVR, or network source"],
    failureModes: ["Camera offline", "NVR down", "Network unreachable", "Storage/source unavailable"],
  },
];

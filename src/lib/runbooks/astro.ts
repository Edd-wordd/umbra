import type { Runbook } from "./types";

export const ASTRO_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:astro:readiness",
    title: "Astro Readiness Check",
    domain: "astro",
    description: "Confirm target window, weather, INDI, mount, camera, storage, and calibration needs before capture.",
    triggers: ["astro_window_candidate", "astro_device_disconnected", "weather_risk", "alignment_required"],
    risk: "physical",
    steps: [
      { id: "plan", title: "Prepare session plan", actionId: "astro.session.plan" },
      { id: "gear", title: "Check gear", actionId: "astro.devices.check" },
      { id: "confirm", title: "Confirm physical actions before mount/capture commands", requiresApproval: true },
    ],
    successCriteria: ["Target/session plan is ready", "Gear status confirmed", "No physical action executed without approval"],
    failureModes: ["Mount disconnected", "Camera unavailable", "Weather risk too high", "Storage insufficient"],
  },
  {
    id: "runbook:astro:session-import",
    title: "Astro Session Image Import",
    domain: "astro",
    description: "Import captured session images into the processing/print pipeline while preserving originals.",
    triggers: ["astro_window_candidate"],
    risk: "prepare",
    steps: [
      { id: "locate", title: "Locate session folder" },
      { id: "import", title: "Import captured images", actionId: "astro.session.import" },
      { id: "link", title: "Link imported image set to Print pipeline" },
    ],
    successCriteria: ["Images imported", "Originals untouched", "Print pipeline can see image set"],
    failureModes: ["Session folder missing", "Calibration frames incomplete", "Insufficient disk space"],
  },
];

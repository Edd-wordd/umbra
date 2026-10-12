import type { Runbook } from "./types";

export const PRINT_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:print:readiness",
    title: "Print Readiness Check",
    domain: "print",
    description: "Confirm printer, paper, profile, queue, and final export before physical printing.",
    triggers: ["print_job_ready", "paper_mismatch", "printer_offline", "print_queue_blocked"],
    risk: "physical",
    steps: [
      { id: "status", title: "Confirm printer is online and queue is clear" },
      { id: "paper", title: "Confirm loaded paper matches job" },
      { id: "profile", title: "Confirm ICC/profile and soft proof" },
      { id: "stage", title: "Stage print", actionId: "print.job.stage" },
      { id: "print", title: "Start print after approval", actionId: "print.job.start", requiresApproval: true },
    ],
    successCriteria: ["Printer starts expected job", "Paper/profile match documented", "Print history can be recorded"],
    failureModes: ["Printer offline", "Queue blocked", "Paper/profile mismatch", "Wrong export selected"],
  },
  {
    id: "runbook:print:astro-pipeline",
    title: "Astro Image Print Pipeline",
    domain: "print",
    description: "Move an astro session from captured frames to stacked/edited/staged print output.",
    triggers: ["print_job_ready"],
    risk: "prepare",
    steps: [
      { id: "import", title: "Import astro session images", actionId: "print.session.import" },
      { id: "stack", title: "Prepare stacking workspace" },
      { id: "edit", title: "Open final stack in Affinity/Lightroom", actionId: "print.image.openInAffinity" },
      { id: "stage", title: "Stage final print", actionId: "print.job.stage" },
    ],
    successCriteria: ["Stacked/edited export is staged", "Original session data remains untouched"],
    failureModes: ["Calibration frames missing", "Stacking tool not selected", "Export profile unknown"],
  },
];

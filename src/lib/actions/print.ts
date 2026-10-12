import type { UmbraAction } from "./types";

export const PRINT_ACTIONS: UmbraAction[] = [
  {
    id: "print.image.openInAffinity",
    label: "Open in Affinity",
    description: "Open the selected print-ready image in Affinity for final edits.",
    domain: "print",
    risk: "read",
    dryRun: (ctx) => ({ summary: "Open image in Affinity", target: String(ctx.args?.imageId ?? "selected image"), expectedResult: "Affinity opens the image for editing." }),
    execute: () => ({ ok: true, message: "Affinity handoff prepared; Mac app execution comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "print.job.stage",
    label: "Stage print",
    description: "Prepare a print job and readiness checklist without starting the printer.",
    domain: "print",
    risk: "prepare",
    dryRun: (ctx) => ({
      summary: "Stage print job",
      target: String(ctx.args?.jobId ?? "selected print job"),
      expectedResult: "Print job is staged with paper/profile checks; printer does not start.",
      rollbackHint: "Remove the staged job before approval.",
    }),
    execute: () => ({ ok: false, message: "print.job.stage is not wired to print staging yet" }),
  },
  {
    id: "print.job.start",
    label: "Start print",
    description: "Start a physical print job on the Canon PRO-1000 after readiness checks.",
    domain: "print",
    risk: "physical",
    dryRun: (ctx) => ({
      summary: "Start physical print",
      target: String(ctx.args?.jobId ?? "selected print job"),
      command: "cups/lpr submit job",
      expectedResult: "Printer consumes paper/ink and starts the selected job.",
      rollbackHint: "Cancel from CUPS if still queued; paper/ink may already be consumed once printing starts.",
      warnings: ["Requires paper/profile confirmation and explicit approval."],
    }),
    execute: () => ({ ok: false, message: "print.job.start is not wired to CUPS executor yet" }),
  },
  {
    id: "print.session.import",
    label: "Import astro session images",
    description: "Collect astro session images into a print/processing workspace.",
    domain: "print",
    risk: "prepare",
    dryRun: (ctx) => ({
      summary: "Import astro session images",
      target: String(ctx.args?.sessionId ?? "last astro session"),
      expectedResult: "Images are gathered into a processing workspace; originals remain untouched.",
    }),
    execute: () => ({ ok: false, message: "print.session.import is not wired to filesystem bridge yet" }),
  },
];

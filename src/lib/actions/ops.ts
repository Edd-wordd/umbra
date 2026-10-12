import type { UmbraAction } from "./types";

export const OPS_ACTIONS: UmbraAction[] = [
  {
    id: "ops.needs.show",
    label: "Show needs",
    description: "Show cross-domain needs that require Edward.",
    domain: "ops",
    risk: "read",
    dryRun: () => ({ summary: "Show Needs Edward", expectedResult: "Cross-domain needs are shown." }),
    execute: () => ({ ok: true, message: "needs view prepared; UI wiring comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "ops.approvals.review",
    label: "Review approvals",
    description: "Review actions waiting for explicit approval.",
    domain: "ops",
    risk: "read",
    dryRun: () => ({ summary: "Review pending approvals", expectedResult: "Pending approval items are shown with risk and dry-run details." }),
    execute: () => ({ ok: true, message: "approval review prepared; UI wiring comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "ops.whatChanged.show",
    label: "Show what changed",
    description: "Show the What Changed summary.",
    domain: "ops",
    risk: "read",
    dryRun: () => ({ summary: "Show What Changed", expectedResult: "Recent cross-domain changes are summarized." }),
    execute: () => ({ ok: true, message: "what changed view prepared; UI wiring comes later" }),
    approvalPolicy: "none",
  },
];

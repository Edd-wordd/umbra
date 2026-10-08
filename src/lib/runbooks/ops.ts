import type { Runbook } from "./types";

export const OPS_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:ops:approval-review",
    title: "Approval Review",
    domain: "ops",
    description: "Review pending approvals with target, risk, dry-run plan, and rollback before approving anything.",
    triggers: ["approval_waiting"],
    risk: "read",
    steps: [
      { id: "review", title: "Review approvals", actionId: "ops.approvals.review" },
      { id: "check", title: "Check target/risk/dry-run" },
      { id: "approve", title: "Approve only specific action and target" },
    ],
    successCriteria: ["Each approval is accepted or denied intentionally", "No broad/vague approval is granted"],
    failureModes: ["Ambiguous target", "Risk underestimated", "Approval applied to wrong action"],
  },
  {
    id: "runbook:ops:what-changed",
    title: "What Changed Review",
    domain: "ops",
    description: "Review the compressed cross-domain change summary and drill into needs when necessary.",
    triggers: ["approval_waiting"],
    risk: "read",
    steps: [
      { id: "show", title: "Show What Changed", actionId: "ops.whatChanged.show" },
      { id: "drill", title: "Open related needs/situations" },
    ],
    successCriteria: ["Edward sees the few changes that matter", "Noise stays out of the main console"],
    failureModes: ["Summary too noisy", "Important change hidden", "Source events unavailable"],
  },
];

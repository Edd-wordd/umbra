import type { Runbook } from "./types";

export const BUSINESS_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:business:lead-followup",
    title: "Lead Follow-up Preparation",
    domain: "business",
    description: "Review lead context and prepare a follow-up without sending until approved.",
    triggers: ["lead_needs_followup", "proposal_viewed", "lead_warm"],
    risk: "external",
    steps: [
      { id: "open", title: "Open lead", actionId: "business.lead.open" },
      { id: "context", title: "Review proposal/activity/context" },
      { id: "draft", title: "Draft follow-up", actionId: "business.followup.draft" },
      { id: "send", title: "Send after approval", actionId: "business.followup.send", requiresApproval: true },
    ],
    successCriteria: ["Follow-up draft is reviewed", "No external message is sent without approval"],
    failureModes: ["Lead context incomplete", "Outbound channel unavailable", "Message sent prematurely"],
  },
];

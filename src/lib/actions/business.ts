import type { UmbraAction } from "./types";

export const BUSINESS_ACTIONS: UmbraAction[] = [
  {
    id: "business.frappe.open",
    label: "Open Frappe",
    description: "Open Frappe CRM.",
    domain: "business",
    risk: "read",
    dryRun: () => ({ summary: "Open Frappe CRM", target: "Frappe", expectedResult: "Frappe opens in the browser." }),
    execute: () => ({ ok: true, message: "Frappe open prepared; browser execution comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "business.lead.open",
    label: "Open lead",
    description: "Open the related lead/deal in Frappe.",
    domain: "business",
    risk: "read",
    dryRun: (ctx) => ({ summary: "Open lead", target: String(ctx.args?.entityId ?? "selected lead"), expectedResult: "Lead opens in Frappe." }),
    execute: () => ({ ok: true, message: "lead open prepared; Frappe execution comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "business.followup.draft",
    label: "Draft follow-up",
    description: "Draft a follow-up for a lead without sending it.",
    domain: "business",
    risk: "prepare",
    dryRun: (ctx) => ({
      summary: "Draft lead follow-up",
      target: String(ctx.args?.entityId ?? "selected lead"),
      expectedResult: "A follow-up draft is prepared for Edward to review; nothing is sent.",
    }),
    execute: () => ({ ok: false, message: "business.followup.draft is not wired to a drafting surface yet" }),
  },
  {
    id: "business.followup.send",
    label: "Send follow-up",
    description: "Send an approved follow-up to a lead.",
    domain: "business",
    risk: "external",
    dryRun: (ctx) => ({
      summary: "Send lead follow-up",
      target: String(ctx.args?.entityId ?? "selected lead"),
      expectedResult: "A message is sent externally to the lead.",
      rollbackHint: "Cannot unsend; send correction if needed.",
      warnings: ["Requires explicit approval and final message review."],
    }),
    execute: () => ({ ok: false, message: "business.followup.send is not wired to outbound comms yet" }),
  },
];

import { getAction } from "../actions";
import { actionRequiresApproval } from "../actions/policy";
import type { CommandRoute } from "./types";

interface LocalRule {
  id: string;
  match: RegExp;
  actionId: string;
  confidence: number;
  reason: string;
  args?: (input: string) => Record<string, string>;
}

const RULES: LocalRule[] = [
  { id: "open-proxmox", match: /\b(open|show|launch)\b.*\bproxmox\b/i, actionId: "lab.proxmox.open", confidence: 0.95, reason: "matched open/proxmox" },
  { id: "open-frappe", match: /\b(open|show|launch)\b.*\bfrappe\b/i, actionId: "business.frappe.open", confidence: 0.95, reason: "matched open/frappe" },
  { id: "show-needs", match: /\b(show|what|list)\b.*\b(needs|need me|needs edward)\b/i, actionId: "ops.needs.show", confidence: 0.9, reason: "matched needs request" },
  { id: "what-changed", match: /\b(what changed|changed since|since i left)\b/i, actionId: "ops.whatChanged.show", confidence: 0.95, reason: "matched what-changed request" },
  { id: "review-approvals", match: /\b(approval|approvals|approve|pending)\b/i, actionId: "ops.approvals.review", confidence: 0.85, reason: "matched approval review" },
  { id: "restart-immich", match: /\b(restart|reboot)\b.*\bimmich\b/i, actionId: "lab.service.restart", confidence: 0.9, reason: "matched restart/immich", args: () => ({ entityId: "service:lab:immich" }) },
  { id: "restart-n8n", match: /\b(restart|reboot)\b.*\bn8n\b/i, actionId: "lab.service.restart", confidence: 0.9, reason: "matched restart/n8n", args: () => ({ entityId: "service:lab:n8n" }) },
  { id: "send-followup", match: /\b(send|email)\b.*\b(follow[- ]?up|lead)\b/i, actionId: "business.followup.send", confidence: 0.75, reason: "matched outbound follow-up" },
  { id: "draft-followup", match: /\b(draft|prepare)\b.*\b(follow[- ]?up|lead)\b/i, actionId: "business.followup.draft", confidence: 0.85, reason: "matched draft follow-up" },
  { id: "open-affinity", match: /\b(open|show|launch)\b.*\baffinity\b/i, actionId: "print.image.openInAffinity", confidence: 0.75, reason: "matched open/affinity" },
  { id: "check-astro", match: /\b(check|show)\b.*\b(astro|gear|mount|camera)\b/i, actionId: "astro.devices.check", confidence: 0.75, reason: "matched astro gear check" },
];

export async function routeCommand(input: string): Promise<CommandRoute> {
  const trimmed = input.trim();
  const rule = RULES.find((candidate) => candidate.match.test(trimmed));
  if (!rule) return { input, source: "local", confidence: 0, reason: "no local rule matched", args: {}, unresolved: true };
  const action = getAction(rule.actionId);
  if (!action) return { input, source: "local", actionId: rule.actionId, confidence: rule.confidence, reason: `${rule.reason}; action not registered`, args: {}, unresolved: true };
  const args = rule.args?.(trimmed) ?? {};
  const plan = await action.dryRun({ source: "system", actor: "umbra", approved: false, args });
  return {
    input,
    source: "local",
    actionId: action.id,
    confidence: rule.confidence,
    reason: rule.reason,
    args,
    action,
    requiresApproval: actionRequiresApproval(action),
    plan,
  };
}

export async function routeCommandSamples(inputs: readonly string[]): Promise<CommandRoute[]> {
  return Promise.all(inputs.map(routeCommand));
}

import type { ApprovalRequest } from "./types";

const approvals = new Map<string, ApprovalRequest>();

export function listApprovalRequests(): ApprovalRequest[] {
  return [...approvals.values()].sort((a, b) => b.requestedAt - a.requestedAt);
}

export function addApprovalRequest(request: ApprovalRequest): ApprovalRequest {
  approvals.set(request.id, request);
  return request;
}

export function decideApprovalRequest(id: string, status: "approved" | "denied"): ApprovalRequest | null {
  const request = approvals.get(id);
  if (!request) return null;
  const next = { ...request, status };
  approvals.set(id, next);
  return next;
}

export function createApprovalId(actionId: string, now = Date.now()) {
  return `approval:${actionId}:${now}`;
}

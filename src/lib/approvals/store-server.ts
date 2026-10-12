import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApprovalRequest } from "./types";

const APPROVALS_PATH = path.join(process.cwd(), ".umbra", "runtime", "approvals.json");

export async function readApprovalRequestsFile(): Promise<ApprovalRequest[]> {
  try {
    const text = await readFile(APPROVALS_PATH, "utf8");
    return JSON.parse(text) as ApprovalRequest[];
  } catch {
    return [];
  }
}

export async function writeApprovalRequestsFile(approvals: ApprovalRequest[]): Promise<void> {
  await mkdir(path.dirname(APPROVALS_PATH), { recursive: true });
  await writeFile(APPROVALS_PATH, JSON.stringify(approvals, null, 2));
}

export async function addApprovalRequestFile(request: ApprovalRequest): Promise<ApprovalRequest> {
  const approvals = await readApprovalRequestsFile();
  const next = [request, ...approvals.filter((approval) => approval.id !== request.id)];
  await writeApprovalRequestsFile(next);
  return request;
}

export async function decideApprovalRequestFile(id: string, status: "approved" | "denied"): Promise<ApprovalRequest | null> {
  const approvals = await readApprovalRequestsFile();
  const index = approvals.findIndex((approval) => approval.id === id);
  if (index === -1) return null;
  approvals[index] = { ...approvals[index], status };
  await writeApprovalRequestsFile(approvals);
  return approvals[index];
}

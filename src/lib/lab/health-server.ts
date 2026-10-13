import "server-only";

import { readFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";

export type LabHealthState = "ok" | "auth_required" | "down" | "timeout" | "tls_error" | "unreachable" | "refused" | "dns_error" | "error";

export interface LabHealthTarget {
  id: string;
  label: string;
  url: string;
  healthUrl?: string;
  kind?: string;
  okStatuses?: number[];
  allowSelfSigned?: boolean;
}

export interface LabHealthResult extends LabHealthTarget {
  configured: true;
  ok: boolean;
  state: LabHealthState;
  status?: number;
  ms: number;
  error?: string;
}

export interface LabHealthSummary {
  configured: boolean;
  checkedAt: number;
  results: LabHealthResult[];
}

const REGISTRY_PATH = path.join(process.cwd(), ".umbra", "lab", "services.json");

export async function getLabHealth(): Promise<LabHealthSummary> {
  const targets = await configuredTargets();
  const checkedAt = Date.now();
  if (!targets.length) return { configured: false, checkedAt, results: [] };
  const results = await Promise.all(targets.map(checkTarget));
  return { configured: true, checkedAt, results };
}

async function configuredTargets(): Promise<LabHealthTarget[]> {
  const registry = await readRegistryTargets();
  if (registry.length) return registry;
  return [
    envTarget("proxmox", "Proxmox", process.env.UMBRA_LAB_PROXMOX_URL, process.env.UMBRA_LAB_PROXMOX_HEALTH_URL, "proxmox", [200, 401, 403]),
    envTarget("adguard", "AdGuard", process.env.UMBRA_LAB_ADGUARD_URL, process.env.UMBRA_LAB_ADGUARD_HEALTH_URL, "dns", [200, 401, 403]),
    envTarget("n8n", "n8n", process.env.UMBRA_LAB_N8N_URL, process.env.UMBRA_LAB_N8N_HEALTH_URL, "automation", [200]),
  ].filter(Boolean) as LabHealthTarget[];
}

async function readRegistryTargets(): Promise<LabHealthTarget[]> {
  try {
    const text = await readFile(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(text) as LabHealthTarget[];
    return parsed.filter((target) => target.id && target.label && target.url);
  } catch {
    return [];
  }
}

function envTarget(id: string, label: string, url: string | undefined, healthUrl?: string, kind?: string, okStatuses?: number[]): LabHealthTarget | null {
  if (!url) return null;
  return { id, label, url, healthUrl, kind, okStatuses };
}

async function checkTarget(target: LabHealthTarget): Promise<LabHealthResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    if (target.allowSelfSigned && (target.healthUrl ?? target.url).startsWith("https://")) return await checkSelfSignedTarget(target, start);
    const res = await fetch(target.healthUrl ?? target.url, { method: "GET", cache: "no-store", signal: controller.signal });
    const state = classifyStatus(res.status, target.okStatuses ?? [200]);
    return { ...target, configured: true, ok: state === "ok" || state === "auth_required", state, status: res.status, ms: Date.now() - start };
  } catch (error) {
    const state = classifyError(error);
    return { ...target, configured: true, ok: false, state, ms: Date.now() - start, error: error instanceof Error ? error.message : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

async function checkSelfSignedTarget(target: LabHealthTarget, start: number): Promise<LabHealthResult> {
  const url = new URL(target.healthUrl ?? target.url);
  const okStatuses = target.okStatuses ?? [200];
  return new Promise((resolve) => {
    const req = https.request(
      url,
      { method: "GET", rejectUnauthorized: false, timeout: 2500 },
      (res) => {
        res.resume();
        const status = res.statusCode ?? 0;
        const state = classifyStatus(status, okStatuses);
        resolve({ ...target, configured: true, ok: state === "ok" || state === "auth_required", state, status, ms: Date.now() - start });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ...target, configured: true, ok: false, state: "timeout", ms: Date.now() - start, error: "timeout" });
    });
    req.on("error", (error) => {
      const state = classifyError(error);
      resolve({ ...target, configured: true, ok: false, state, ms: Date.now() - start, error: error.message });
    });
    req.end();
  });
}

function classifyStatus(status: number, okStatuses: number[]): LabHealthState {
  if (okStatuses.includes(status)) return status === 401 || status === 403 ? "auth_required" : "ok";
  if (status === 401 || status === 403) return "auth_required";
  return "down";
}

function classifyError(error: unknown): LabHealthState {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "timeout";
    const message = error.message.toLowerCase();
    if (message.includes("certificate") || message.includes("tls") || message.includes("self-signed")) return "tls_error";
    if (message.includes("ehostunreach") || message.includes("enetunreach") || message.includes("no route")) return "unreachable";
    if (message.includes("econnrefused")) return "refused";
    if (message.includes("enotfound") || message.includes("eai_again")) return "dns_error";
  }
  return "error";
}

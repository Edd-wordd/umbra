import "server-only";

export interface LabHealthTarget {
  id: string;
  label: string;
  url: string;
}

export interface LabHealthResult extends LabHealthTarget {
  configured: true;
  ok: boolean;
  status?: number;
  ms: number;
  error?: string;
}

export interface LabHealthSummary {
  configured: boolean;
  checkedAt: number;
  results: LabHealthResult[];
}

export async function getLabHealth(): Promise<LabHealthSummary> {
  const targets = configuredTargets();
  const checkedAt = Date.now();
  if (!targets.length) return { configured: false, checkedAt, results: [] };
  const results = await Promise.all(targets.map(checkTarget));
  return { configured: true, checkedAt, results };
}

function configuredTargets(): LabHealthTarget[] {
  return [
    envTarget("proxmox", "Proxmox", process.env.UMBRA_LAB_PROXMOX_URL),
    envTarget("adguard", "AdGuard", process.env.UMBRA_LAB_ADGUARD_URL),
    envTarget("n8n", "n8n", process.env.UMBRA_LAB_N8N_URL),
  ].filter(Boolean) as LabHealthTarget[];
}

function envTarget(id: string, label: string, url: string | undefined): LabHealthTarget | null {
  if (!url) return null;
  return { id, label, url };
}

async function checkTarget(target: LabHealthTarget): Promise<LabHealthResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(target.url, { method: "GET", cache: "no-store", signal: controller.signal });
    return { ...target, configured: true, ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch (error) {
    return { ...target, configured: true, ok: false, ms: Date.now() - start, error: error instanceof Error ? error.message : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

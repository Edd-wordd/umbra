import type { UmbraAction } from "./types";

function openLabUrl(label: string, url: string | undefined) {
  if (!url) return { ok: false, message: `${label} URL is not configured` };
  return { ok: true, message: `Open ${label}`, instruction: { type: "open_url" as const, url } };
}

export const LAB_ACTIONS: UmbraAction[] = [
  {
    id: "lab.proxmox.open",
    label: "Open Proxmox",
    description: "Open the Proxmox UI.",
    domain: "lab",
    risk: "read",
    dryRun: () => ({ summary: "Open Proxmox UI", target: process.env.UMBRA_LAB_PROXMOX_URL ?? "Proxmox", expectedResult: "Proxmox opens in the browser." }),
    execute: () => openLabUrl("Proxmox", process.env.UMBRA_LAB_PROXMOX_URL),
    approvalPolicy: "none",
  },
  {
    id: "lab.adguard.open",
    label: "Open AdGuard",
    description: "Open the AdGuard UI.",
    domain: "lab",
    risk: "read",
    dryRun: () => ({ summary: "Open AdGuard UI", target: process.env.UMBRA_LAB_ADGUARD_URL ?? "AdGuard", expectedResult: "AdGuard opens in the browser." }),
    execute: () => openLabUrl("AdGuard", process.env.UMBRA_LAB_ADGUARD_URL),
    approvalPolicy: "none",
  },
  {
    id: "lab.n8n.open",
    label: "Open n8n",
    description: "Open the n8n UI.",
    domain: "lab",
    risk: "read",
    dryRun: () => ({ summary: "Open n8n UI", target: process.env.UMBRA_LAB_N8N_URL ?? "n8n", expectedResult: "n8n opens in the browser." }),
    execute: () => openLabUrl("n8n", process.env.UMBRA_LAB_N8N_URL),
    approvalPolicy: "none",
  },
  {
    id: "lab.service.open",
    label: "Open service",
    description: "Open the related lab service UI or detail.",
    domain: "lab",
    risk: "read",
    dryRun: (ctx) => ({ summary: "Open lab service", target: String(ctx.args?.entityId ?? "selected service"), expectedResult: "The service UI/detail opens." }),
    execute: () => ({ ok: true, message: "service open prepared; browser execution comes later" }),
    approvalPolicy: "none",
  },
  {
    id: "lab.service.restart",
    label: "Restart service",
    description: "Prepare a restart for a lab service/container/VM.",
    domain: "lab",
    risk: "local-risky",
    dryRun: (ctx) => ({
      summary: "Restart lab service",
      target: String(ctx.args?.entityId ?? "selected service"),
      command: "proxmox/docker restart <target>",
      expectedResult: "The service restarts and health is rechecked.",
      rollbackHint: "Start the service again or restore prior config if restart exposes a config issue.",
      warnings: ["Restart may interrupt active users or background jobs."],
    }),
    execute: () => ({ ok: false, message: "lab.service.restart is not wired to Proxmox/Docker executor yet" }),
  },
  {
    id: "lab.backup.check",
    label: "Check backup",
    description: "Check backup status for a lab service.",
    domain: "lab",
    risk: "read",
    dryRun: (ctx) => ({ summary: "Check backup", target: String(ctx.args?.entityId ?? "selected backup"), expectedResult: "Backup freshness/details are refreshed." }),
    execute: () => ({ ok: false, message: "lab.backup.check is not wired to backup source yet" }),
    approvalPolicy: "none",
  },
  {
    id: "lab.vm.create.plan",
    label: "Plan VM/CT",
    description: "Prepare a VM/CT creation plan without creating anything.",
    domain: "lab",
    risk: "prepare",
    dryRun: () => ({ summary: "Plan new VM/CT", expectedResult: "A Proxmox VM/CT plan is prepared for approval; nothing is created." }),
    execute: () => ({ ok: false, message: "lab.vm.create.plan is not wired to Proxmox planner yet" }),
  },
];

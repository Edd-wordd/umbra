import type { LabSnapshot } from "./types";

export function createSampleLabSnapshot(now = Date.now()): LabSnapshot {
  return {
    hosts: [
      { id: "device:lab:proxmox", label: "Proxmox Host", kind: "proxmox", status: "healthy", cpuPct: 18, memPct: 46, diskPct: 72, url: "https://proxmox.local" },
      { id: "device:lab:docker-media", label: "Docker Media Host", kind: "docker", status: "attention", cpuPct: 34, memPct: 68, diskPct: 81 },
    ],
    services: [
      { id: "service:lab:immich", label: "Immich", kind: "ct", hostId: "device:lab:proxmox", status: "running", url: "https://immich.local" },
      { id: "service:lab:jellyfin", label: "Jellyfin", kind: "ct", hostId: "device:lab:proxmox", status: "running", url: "https://jellyfin.local" },
      { id: "service:lab:adguard", label: "AdGuard", kind: "service", hostId: "device:lab:proxmox", status: "running", url: "https://adguard.local" },
      { id: "service:lab:n8n", label: "n8n", kind: "docker", hostId: "device:lab:docker-media", status: "restarting", url: "https://n8n.local", restarts: 4 },
    ],
    backups: [
      { id: "backup:lab:immich", label: "Immich backup", targetId: "service:lab:immich", status: "stale", lastAt: now - 3 * 24 * 60 * 60_000 },
      { id: "backup:lab:jellyfin", label: "Jellyfin backup", targetId: "service:lab:jellyfin", status: "current", lastAt: now - 8 * 60 * 60_000 },
    ],
  };
}

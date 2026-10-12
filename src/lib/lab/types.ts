export interface LabHost {
  id: string;
  label: string;
  kind: "proxmox" | "docker" | "network";
  status: "healthy" | "attention" | "down";
  cpuPct?: number;
  memPct?: number;
  diskPct?: number;
  url?: string;
}

export interface LabService {
  id: string;
  label: string;
  kind: "vm" | "ct" | "docker" | "service";
  hostId: string;
  status: "running" | "stopped" | "restarting" | "down" | "attention";
  url?: string;
  restarts?: number;
}

export interface LabBackup {
  id: string;
  label: string;
  targetId: string;
  status: "current" | "stale" | "failed";
  lastAt: number;
}

export interface LabSnapshot {
  hosts: LabHost[];
  services: LabService[];
  backups: LabBackup[];
}

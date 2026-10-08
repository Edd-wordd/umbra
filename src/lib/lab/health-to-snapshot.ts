import type { LabSnapshot } from "./types";
import type { LabHealthSummary } from "./health-server";

export function labHealthToSnapshot(health: LabHealthSummary): LabSnapshot {
  return {
    hosts: [
      {
        id: "device:lab:health-checker",
        label: "Lab health checker",
        kind: "network",
        status: health.results.some((result) => !result.ok) ? "attention" : "healthy",
      },
    ],
    services: health.results.map((result) => ({
      id: `service:lab:${result.id}`,
      label: result.label,
      kind: "service",
      hostId: "device:lab:health-checker",
      status: result.ok ? "running" : "down",
      url: result.url,
    })),
    backups: [],
  };
}

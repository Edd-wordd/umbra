import type { Runbook } from "./types";

export const LAB_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:lab:service-restart",
    title: "Lab Service Restart",
    domain: "lab",
    description: "Safely restart a lab service/container/VM and verify health afterward.",
    triggers: ["service_down", "container_restart_loop"],
    risk: "local-risky",
    steps: [
      { id: "open", title: "Open service detail", actionId: "lab.service.open" },
      { id: "logs", title: "Check recent logs/restarts" },
      { id: "restart", title: "Restart after approval", actionId: "lab.service.restart", requiresApproval: true },
      { id: "verify", title: "Verify service health" },
    ],
    successCriteria: ["Service is running", "Health check passes", "No restart loop continues"],
    failureModes: ["Service config broken", "Host resource pressure", "Dependent service down"],
  },
  {
    id: "runbook:lab:backup-check",
    title: "Backup Verification",
    domain: "lab",
    description: "Check stale or failed backups before they become data-loss risk.",
    triggers: ["backup_stale"],
    risk: "read",
    steps: [
      { id: "check", title: "Check backup status", actionId: "lab.backup.check" },
      { id: "source", title: "Confirm source service/storage is reachable" },
      { id: "plan", title: "Prepare remediation if backup failed" },
    ],
    successCriteria: ["Backup status is known", "Next backup/remediation path is clear"],
    failureModes: ["Backup target unavailable", "Storage full", "Credentials expired"],
  },
  {
    id: "runbook:lab:vm-ct-provision",
    title: "VM/CT Provisioning",
    domain: "lab",
    description: "Prepare a Proxmox VM/CT plan before creating infrastructure.",
    triggers: ["service_down"],
    risk: "local-risky",
    steps: [
      { id: "plan", title: "Prepare VM/CT plan", actionId: "lab.vm.create.plan" },
      { id: "review", title: "Review CPU/memory/disk/network" },
      { id: "approve", title: "Create only after explicit approval", requiresApproval: true },
    ],
    successCriteria: ["Plan is complete", "No resources are created before approval"],
    failureModes: ["Insufficient host resources", "Network/storage selection wrong"],
  },
];

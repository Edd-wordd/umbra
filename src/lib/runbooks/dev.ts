import type { Runbook } from "./types";

export const DEV_RUNBOOKS: Runbook[] = [
  {
    id: "runbook:dev:stale-port",
    title: "Stale Port Recovery",
    domain: "dev",
    description: "Recover a local dev server blocked by a stale or orphaned port process.",
    triggers: ["stale_port"],
    risk: "local-risky",
    steps: [
      { id: "identify", title: "Identify process", description: "Confirm the process, port, cwd, and owner session." },
      { id: "dry-run", title: "Prepare kill", actionId: "dev.port.free", requiresApproval: true },
      { id: "verify", title: "Verify port is free or expected server restarted" },
    ],
    successCriteria: ["Port is free or the expected dev server responds", "No active Herdr pane was interrupted unexpectedly"],
    failureModes: ["Process belongs to an active session", "Permission denied", "Server restart fails"],
  },
  {
    id: "runbook:dev:failed-ci",
    title: "Failed CI Triage",
    domain: "dev",
    description: "Inspect failing CI and connect it to the active repo/agent context.",
    triggers: ["failed_ci"],
    risk: "external",
    steps: [
      { id: "open", title: "Open failing CI", actionId: "dev.ci.open" },
      { id: "connect", title: "Connect failure to repo, branch, active agent, and recent changes" },
      { id: "rerun", title: "Rerun only when failure looks transient", actionId: "dev.ci.rerun", requiresApproval: true },
    ],
    successCriteria: ["Failure cause is known or assigned", "Rerun is only used for likely transient failures"],
    failureModes: ["Provider unavailable", "Failure requires code changes", "Rerun hides a real defect"],
  },
  {
    id: "runbook:dev:blocked-agent",
    title: "Blocked Agent Resolution",
    domain: "dev",
    description: "Resolve an agent waiting on Edward without blindly approving risky work.",
    triggers: ["blocked_agent"],
    risk: "local-risky",
    steps: [
      { id: "open", title: "Open agent session", actionId: "dev.sessions.resume" },
      { id: "read", title: "Read exact prompt and target workspace" },
      { id: "approve", title: "Approve if safe", actionId: "dev.agent.approve", requiresApproval: true },
      { id: "deny", title: "Deny if unsafe", actionId: "dev.agent.deny" },
    ],
    successCriteria: ["Prompt is approved or denied intentionally", "Agent continues only within expected workspace/risk"],
    failureModes: ["Prompt changed since review", "Agent target is ambiguous", "Requested action is destructive/security-sensitive"],
  },
];

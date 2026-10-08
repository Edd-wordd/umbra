import type { BrainNode, BrainStatus } from "../brain/types";

export type DevSituationType =
  | "blocked_agent"
  | "failed_ci"
  | "stale_port"
  | "dirty_repo"
  | "local_only_work"
  | "service_attention"
  | "project_blocked";

export type PrintSituationType = "printer_offline" | "print_queue_blocked" | "print_job_ready" | "ink_low" | "paper_mismatch";

export type AstroSituationType = "astro_window_candidate" | "astro_device_disconnected" | "weather_risk" | "alignment_required";

export type LabSituationType = "service_down" | "container_restart_loop" | "backup_stale" | "tailscale_unreachable" | "disk_pressure";

export type BusinessSituationType = "lead_warm" | "lead_needs_followup" | "proposal_viewed" | "reply_draft_ready";

export type KnowledgeSituationType = "note_untyped" | "decision_missing" | "runbook_missing" | "orphan_note";

export type CameraSituationType = "camera_offline" | "stream_unreachable";

export type SituationType =
  | DevSituationType
  | PrintSituationType
  | AstroSituationType
  | LabSituationType
  | BusinessSituationType
  | KnowledgeSituationType
  | CameraSituationType
  | (string & {});

export type SituationLifecycle = "new" | "active" | "waiting" | "snoozed" | "resolved" | "ignored" | "recurring";

export interface SituationActionRef {
  id: string;
  label: string;
  risk?: string;
}

export interface Situation {
  id: string;
  type: SituationType;
  sourceTypes?: SituationType[];
  title: string;
  status: SituationLifecycle;
  severity: BrainStatus;
  confidence: number;
  entities: string[];
  signals: string[];
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  summary: string;
  whyNow: string;
  suggestedActions: SituationActionRef[];
  needsHuman: boolean;
}

export interface SituationInput {
  nodes: BrainNode[];
  now?: number;
}

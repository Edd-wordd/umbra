// Explicit UI-only destinations. Never infer execution permission from speech.
export const RAIL_NAVIGATION = {
  "lab.rail.show": "lab",
  "knowledge.rail.show": "knowledge",
  "dev.rail.show": "dev",
} as const;
export const OPS_NAVIGATION: Record<string, string> = {
  "ops.needs.show": "/ops#needs-edward",
  "ops.approvals.review": "/ops#approvals",
  "ops.whatChanged.show": "/ops#what-changed",
};

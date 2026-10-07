"use client";

import { useDevStore } from "@/lib/dev/store";
import { useUmbra } from "@/lib/store";
import { getTool, runTool } from "@/lib/tools";

/**
 * Approve whatever is pending in the Dev focus. Actions backed by a tool
 * (e.g. free port -> dev.port.free) run through the shared tool layer with
 * `approved: true`, exactly like the ⌘K palette's confirm step.
 */
export async function approvePending(): Promise<void> {
  const dev = useDevStore.getState();
  const p = dev.pending;
  if (!p) return;
  if (!p.toolId) {
    dev.approvePending();
    return;
  }
  dev.clearPending();
  const tool = getTool(p.toolId);
  if (!tool) return dev.log("touch", `unknown tool ${p.toolId}`, "error");
  const { wakeRail, setMode, toIdle } = useUmbra.getState();
  const res = await runTool(tool, { source: "touch", approved: true, args: p.args, wakeRail, setMode, toIdle });
  if (!res.ok) dev.log("touch", res.message, "error");
  // A triaged event fixed with its one action leaves the Needs-you list.
  else if (p.signalId) useDevStore.setState((s) => ({ signals: s.signals.filter((x) => x.id !== p.signalId) }));
}

export const denyPending = () => useDevStore.getState().denyPending();

/** Card actions on service details: read tools from the shared tool layer. */
export async function runServiceAction(toolId: string, args?: Record<string, string>): Promise<void> {
  const tool = getTool(toolId);
  const dev = useDevStore.getState();
  if (!tool) return dev.log("touch", `unknown tool ${toolId}`, "error");
  const { wakeRail, setMode, toIdle } = useUmbra.getState();
  const res = await runTool(tool, { source: "touch", approved: false, args, wakeRail, setMode, toIdle });
  if (!res.ok) dev.log("touch", res.message, "error");
}

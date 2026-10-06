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
}

export const denyPending = () => useDevStore.getState().denyPending();

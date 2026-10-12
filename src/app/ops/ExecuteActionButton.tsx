"use client";

import { useState } from "react";

export function ExecuteActionButton({ actionId, approvalId }: { actionId: string; approvalId?: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function execute() {
    setState("running");
    const result = await fetch("/api/actions/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionId, approvalId }),
    })
      .then((res) => res.json())
      .catch(() => ({ ok: false, message: "execute request failed" }));
    setMessage(result.message ?? result.error ?? "unknown result");
    setState(result.ok ? "done" : "failed");
  }

  return (
    <span className="ml-3 inline-flex items-center gap-2">
      <button type="button" disabled={state === "running"} onClick={() => void execute()} className="text-[9px] tracking-[1.5px] text-cyan-200 hover:text-cyan-50 disabled:opacity-40">
        {state === "running" ? "EXECUTING" : state === "done" ? "EXECUTED" : "EXECUTE"}
      </button>
      {message && <span className={state === "failed" ? "text-[9px] text-amber-200" : "text-[9px] text-slate-500"}>{message}</span>}
    </span>
  );
}

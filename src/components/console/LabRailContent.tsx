"use client";

import { useEffect, useState } from "react";

type LabHealth = {
  configured: boolean;
  results: Array<{ id: string; label: string; ok: boolean; state: string; status?: number; ms: number; error?: string }>;
};

type Approvals = {
  approvals: Array<{ id: string; actionId: string; actionLabel: string; status: string; plan: { target?: string } }>;
};

export default function LabRailContent({ openPalette }: { openPalette: (query?: string) => void }) {
  const [health, setHealth] = useState<LabHealth | null>(null);
  const [approvals, setApprovals] = useState<Approvals["approvals"]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/lab/health", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
      fetch("/api/approvals", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
    ]).then(([labHealth, approvalData]: [LabHealth | null, Approvals | null]) => {
      if (cancelled) return;
      setHealth(labHealth);
      setApprovals((approvalData?.approvals ?? []).filter((approval) => approval.actionId.startsWith("lab.")).slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="mt-[20px] border-t border-line pt-[12px]">
        <div className="flex justify-between text-[9.5px]">
          <span className="tracking-[2px] text-mid">HEALTH</span>
          <span className="text-dim">live</span>
        </div>
        <div className="mt-[6px] space-y-[6px] text-[10.5px] leading-[1.4]">
          {!health && <p className="text-dim">loading…</p>}
          {health && !health.configured && <p className="text-attention">not configured</p>}
          {health?.results.map((result) => (
            <p key={result.id} className={result.ok ? "text-mid" : "text-attention"}>
              {result.label} · {result.state} · {result.status ?? result.error ?? "no response"} · {result.ms}ms
            </p>
          ))}
        </div>
      </div>

      <div className="mt-[20px] border-t border-line pt-[12px]">
        <div className="flex justify-between text-[9.5px]">
          <span className="tracking-[2px] text-mid">APPROVALS</span>
          <span className="text-dim">lab</span>
        </div>
        <div className="mt-[6px] space-y-[6px] text-[10.5px] leading-[1.4]">
          {approvals.length === 0 && <p className="text-dim">none</p>}
          {approvals.map((approval) => (
            <p key={approval.id} className={approval.status === "pending" ? "text-attention" : "text-dim"}>
              {approval.status} · {approval.actionLabel} · {approval.plan.target ?? approval.actionId}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-[20px] border-t border-line pt-[12px]">
        <div className="flex justify-between text-[9.5px]">
          <span className="tracking-[2px] text-mid">ACTIONS</span>
          <span className="text-dim">safe opens</span>
        </div>
        <div className="mt-[10px] flex flex-wrap gap-[12px] text-[10px]">
          <button type="button" onClick={() => openPalette("open Proxmox")} className="text-dim hover:text-ink">Proxmox</button>
          <button type="button" onClick={() => openPalette("open AdGuard")} className="text-dim hover:text-ink">AdGuard</button>
          <button type="button" onClick={() => openPalette("open n8n")} className="text-dim hover:text-ink">n8n</button>
        </div>
      </div>
    </>
  );
}

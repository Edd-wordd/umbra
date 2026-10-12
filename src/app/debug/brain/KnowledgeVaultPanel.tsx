"use client";

import { useEffect, useState } from "react";

interface VaultStatus {
  configured: boolean;
  accepted?: number;
  rejected?: number;
  graph?: { nodes: number; edges: number };
  memory?: number;
  rejectedSamples?: Array<{ path: string; reason: string }>;
  error?: string;
}

export default function KnowledgeVaultPanel() {
  const [status, setStatus] = useState<VaultStatus | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/knowledge/index", { cache: "no-store" })
      .then((res) => res.json() as Promise<VaultStatus>)
      .then((data) => {
        if (alive) setStatus(data);
      })
      .catch((error: unknown) => {
        if (alive) setStatus({ configured: false, error: error instanceof Error ? error.message : "failed to load" });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!status) return <p className="text-sm text-slate-500">loading vault status…</p>;

  return (
    <div className="space-y-2 text-sm text-slate-300">
      <p>configured: <span className={status.configured ? "text-cyan-200" : "text-amber-200"}>{status.configured ? "yes" : "no"}</span></p>
      {status.error && <p className="text-amber-300/80">{status.error}</p>}
      {status.configured && !status.error && (
        <>
          <p>accepted: <span className="text-cyan-200">{status.accepted}</span></p>
          <p>rejected: <span className="text-amber-200">{status.rejected}</span></p>
          <p>graph: <span className="text-cyan-200">{status.graph?.nodes} nodes / {status.graph?.edges} edges</span></p>
          {(status.rejectedSamples ?? []).map((sample) => (
            <p key={sample.path} className="text-amber-300/80">skipped {sample.path}: {sample.reason}</p>
          ))}
        </>
      )}
    </div>
  );
}

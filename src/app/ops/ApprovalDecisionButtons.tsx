"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalDecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approved" | "denied" | null>(null);

  async function decide(decision: "approved" | "denied") {
    setBusy(decision);
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, decision }),
    }).catch(() => null);
    router.refresh();
  }

  return (
    <span className="ml-3 inline-flex gap-2">
      <button type="button" disabled={busy !== null} onClick={() => void decide("approved")} className="text-[9px] tracking-[1.5px] text-cyan-200 hover:text-cyan-50 disabled:opacity-40">
        {busy === "approved" ? "APPROVING" : "APPROVE"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void decide("denied")} className="text-[9px] tracking-[1.5px] text-amber-200 hover:text-amber-50 disabled:opacity-40">
        {busy === "denied" ? "DENYING" : "DENY"}
      </button>
    </span>
  );
}

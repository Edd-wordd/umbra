"use client";

import { useEffect, useRef } from "react";
import { useDevStore } from "@/lib/dev/store";
import type { ActivityResult } from "@/lib/dev/types";
import { formatClockSeconds } from "@/lib/time";

const RESULT: Record<ActivityResult, { label: string; cls: string }> = {
  ok: { label: "ok", cls: "text-mid" },
  info: { label: "info", cls: "text-dim" },
  denied: { label: "denied", cls: "text-dim" },
  pending: { label: "needs yes", cls: "text-attention" },
  error: { label: "error", cls: "text-broken" },
};

/** Every Dev action, timestamped. Doubles as the brain's memory later (Supabase). */
export default function ActivityLog() {
  const activity = useDevStore((s) => s.activity);
  const ref = useRef<HTMLOListElement>(null);
  const last = activity.at(-1)?.id;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  return (
    <section aria-label="activity log" className="flex gap-[18px] border-t border-line px-5 pb-[10px] pt-[10px]">
      <div className="w-[96px] shrink-0 text-[9.5px] leading-[16px]">
        <div className="tracking-[2px] text-mid">ACTIVITY</div>
        <div className="text-dim">{activity.length} today</div>
      </div>
      <ol ref={ref} className="h-[64px] min-w-0 flex-1 overflow-y-auto text-[10px] leading-[16px]" data-activity>
        {activity.map((e) => {
          const r = RESULT[e.result];
          return (
            <li key={e.id} className="flex gap-[14px]">
              <span className="w-[56px] shrink-0 tabular-nums text-dim">{formatClockSeconds(new Date(e.at))}</span>
              <span className="w-[48px] shrink-0 text-dim">{e.source}</span>
              <span className="min-w-0 flex-1 truncate text-mid">{e.text}</span>
              <span className={`w-[64px] shrink-0 text-right ${r.cls}`}>{r.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useDevStore } from "@/lib/dev/store";
import type { ActivityEntry, ActivityResult } from "@/lib/dev/types";
import { formatClockSeconds } from "@/lib/time";

const RESULT: Record<ActivityResult, { label: string; cls: string }> = {
  ok: { label: "ok", cls: "text-mid" },
  info: { label: "info", cls: "text-dim" },
  denied: { label: "denied", cls: "text-dim" },
  pending: { label: "needs yes", cls: "text-attention" },
  error: { label: "error", cls: "text-broken" },
};

function Entry({ e }: { e: ActivityEntry }) {
  const r = RESULT[e.result];
  return (
    <>
      <span className="w-[56px] shrink-0 tabular-nums text-dim">{formatClockSeconds(new Date(e.at))}</span>
      <span className="w-[48px] shrink-0 text-dim">{e.source}</span>
      <span className="min-w-0 flex-1 truncate text-mid">{e.text}</span>
      <span className={`w-[64px] shrink-0 text-right ${r.cls}`}>{r.label}</span>
    </>
  );
}

/** Every Dev action, timestamped: one latest-line strip that opens into a drawer. */
export default function ActivityLog() {
  const activity = useDevStore((s) => s.activity);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLOListElement>(null);
  const last = activity.at(-1);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last?.id, open]);

  return (
    <section aria-label="activity log" className="relative shrink-0 border-t border-line">
      {open && (
        <ol
          ref={ref}
          data-activity
          className="umbra-fade-in absolute inset-x-0 bottom-full max-h-[220px] overflow-y-auto border-t border-line bg-panel px-5 py-[8px] text-[10px] leading-[18px]"
        >
          {activity.map((e) => (
            <li key={e.id} className="flex gap-[14px]">
              <Entry e={e} />
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-[30px] w-full items-center gap-[14px] px-5 text-left text-[10px] hover:bg-panel-raised/40"
        data-activity-strip
      >
        <span className="w-[72px] shrink-0 text-[9.5px] tracking-[2px] text-dim">ACTIVITY</span>
        {last ? <Entry e={last} /> : <span className="text-ghost">nothing yet</span>}
        <span className="w-[36px] shrink-0 text-right text-[9.5px] text-ghost">
          {activity.length} {open ? "▾" : "▴"}
        </span>
      </button>
    </section>
  );
}

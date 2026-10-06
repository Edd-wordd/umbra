"use client";

import { useEffect, useRef, useState } from "react";
import { useDevStore } from "@/lib/dev/store";
import type { ActivityEntry, ActivityResult } from "@/lib/dev/types";
import { formatClockSeconds } from "@/lib/time";

const RESULT: Record<ActivityResult, { label: string; cls: string }> = {
  ok: { label: "ok", cls: "text-ink" },
  info: { label: "info", cls: "text-dim" },
  denied: { label: "denied", cls: "text-dim" },
  pending: { label: "needs yes", cls: "text-attention" },
  error: { label: "error", cls: "text-broken" },
};

function Entry({ e }: { e: ActivityEntry }) {
  const r = RESULT[e.result];
  return (
    <>
      <span className="w-[54px] shrink-0 tabular-nums text-dim">{formatClockSeconds(new Date(e.at))}</span>
      <span className="label w-[46px] shrink-0 self-center text-dim">{e.source}</span>
      <span className="min-w-0 flex-1 truncate text-mid">{e.text}</span>
      <span className={`label w-[74px] shrink-0 whitespace-nowrap self-center text-right ${r.cls}`}>{r.label}</span>
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
          className="umbra-fade-in absolute inset-x-[-1px] bottom-full max-h-[240px] overflow-y-auto border border-b-0 border-line bg-panel px-5 py-[10px] text-[10px] leading-[20px]"
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
        className="flex h-[32px] w-full items-center gap-[12px] px-5 text-left text-[10px] hover:bg-panel-raised"
        data-activity-strip
      >
        <span className="label w-[22px] shrink-0 text-dim">LOG</span>
        {last ? <Entry e={last} /> : <span className="text-ghost">nothing yet</span>}
        <span className="label w-[34px] shrink-0 text-right text-ghost">
          {activity.length} {open ? "▾" : "▴"}
        </span>
      </button>
    </section>
  );
}

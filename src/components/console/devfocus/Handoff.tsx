"use client";

import { useEffect } from "react";
import { useDevStore } from "@/lib/dev/store";
import { formatClock } from "@/lib/time";
import { Btn, Dot } from "./ui";

const RANK = { broken: 0, attention: 1, active: 2, mid: 3 } as const;
export const HANDOFF_AUTO_FOLD_MS = 30_000;

/**
 * "Where you left off": a short card on the first open only. Folds after the
 * first interaction anywhere in the Dev view or after 30 s; reopen from the
 * header ("left off") or ⌘K "Where I left off".
 */
export default function Handoff() {
  const handoff = useDevStore((s) => s.handoff);
  const open = useDevStore((s) => s.handoffOpen);
  const setHandoff = useDevStore((s) => s.setHandoff);
  const resume = useDevStore((s) => s.resumeSessions);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setHandoff(false), HANDOFF_AUTO_FOLD_MS);
    return () => clearTimeout(t);
  }, [open, setHandoff]);

  if (!open || handoff.items.length === 0) return null;
  const items = [...handoff.items].sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  const shown = items.slice(0, 3);

  return (
    <section aria-label="where you left off" data-handoff className="umbra-fade-in shrink-0 border border-line px-[12px] py-[8px]">
      <div className="flex h-[16px] items-center gap-[10px] text-[9.5px] leading-none">
        <span className="tracking-[2px] text-mid">LEFT OFF</span>
        <span className="text-dim">
          {formatClock(new Date(handoff.at))}
          {items.length > shown.length ? ` · ${items.length} repos` : ""}
        </span>
        <span className="ml-auto flex items-center gap-[4px]">
          <Btn tone="quiet" onClick={() => resume()}>
            RESUME
          </Btn>
          <Btn tone="quiet" onClick={() => setHandoff(false)} title="fold (reopen: left off · ⌘K)">
            ✕
          </Btn>
        </span>
      </div>
      <ul className="mt-[5px]">
        {shown.map((h) => (
          <li key={h.repo} className="flex h-[18px] items-center gap-[10px] text-[10px]">
            <Dot tone={h.tone} />
            <span className="w-[100px] shrink-0 truncate text-mid">{h.repo}</span>
            <span className={`min-w-0 truncate ${h.tone === "broken" ? "text-broken/80" : "text-dim"}`}>{h.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

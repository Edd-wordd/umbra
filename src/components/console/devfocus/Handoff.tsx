"use client";

import { useDevStore } from "@/lib/dev/store";
import { formatClock } from "@/lib/time";
import { Btn, Dot, SectionHead } from "./ui";

/** "Where you left off": last session per repo; collapses once sessions are resumed. */
export default function Handoff() {
  const handoff = useDevStore((s) => s.handoff);
  const open = useDevStore((s) => s.handoffOpen);
  const resume = useDevStore((s) => s.resumeSessions);
  const agents = useDevStore((s) => s.agents.length);
  const drawerOpen = useDevStore((s) => s.expandedProject !== null);

  if (!open || drawerOpen) {
    return (
      <section aria-label="where you left off">
        <SectionHead title="WHERE YOU LEFT OFF" meta={open ? `${handoff.items.length} repos · folded while a project is open` : `resumed · ${agents} sessions reattached`}>
          <button type="button" className="text-dim hover:text-ink" onClick={() => useDevStore.setState({ handoffOpen: true, expandedProject: null })}>
            show ▾
          </button>
        </SectionHead>
      </section>
    );
  }

  return (
    <section aria-label="where you left off" className="shrink-0">
      <SectionHead title="WHERE YOU LEFT OFF" meta={`last session ${formatClock(new Date(handoff.at))}`}>
        <Btn onClick={() => useDevStore.setState({ handoffOpen: false })} tone="quiet">
          DISMISS
        </Btn>
        <Btn onClick={() => resume()}>RESUME SESSIONS</Btn>
      </SectionHead>
      <ul className="mt-[8px]">
        {handoff.items.map((h) => (
          <li key={h.repo} className="flex h-[20px] items-center gap-[8px] text-[10.5px]">
            <Dot tone={h.tone === "mid" ? "mid" : h.tone} />
            <span className="w-[112px] shrink-0 truncate text-ink">{h.repo}</span>
            <span className="w-[132px] shrink-0 truncate text-dim">{h.branch}</span>
            <span className={`min-w-0 truncate ${h.tone === "broken" ? "text-broken/85" : "text-mid"}`}>{h.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

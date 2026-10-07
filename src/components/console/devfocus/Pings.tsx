"use client";

import { useDevStore } from "@/lib/dev/store";
import { formatAge } from "@/lib/dev/format";
import type { Ping } from "@/lib/dev/types";
import { useMinuteClock } from "@/lib/hooks/useClock";
import { AccentDot, SectionHead } from "./ui";

/**
 * herdr / cursor jumps act on the Mac (focus a pane, open Cursor) and answer
 * with a tiny page, so hit them in the background instead of opening a tab.
 * localhost / GitHub jumps are pages: open them.
 */
function follow(p: Ping) {
  if (!p.jump || p.target === "localhost" || p.target === "url") return false;
  void fetch(p.jump, { mode: "no-cors", cache: "no-store" }).catch(() => {});
  return true;
}

function Row({ p, now }: { p: Ping; now?: number }) {
  const body = (
    <>
      <AccentDot repo={p.repo} />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-ink/90">{p.title}</span>
        <span className="text-dim"> · {p.message}</span>
      </span>
      <span className="shrink-0 tabular-nums text-dim">{now ? formatAge(now - p.at) : ""}</span>
      {p.jump && <span className="shrink-0 text-dim transition-colors group-hover:text-active">↗</span>}
    </>
  );
  const cls = "group flex h-[22px] items-center gap-[9px] text-[10.5px] leading-none";
  if (!p.jump) return <li className={cls}>{body}</li>;
  return (
    <li>
      <a
        href={p.jump}
        target="_blank"
        rel="noreferrer"
        title={`${p.title} · ${p.message}`}
        className={`${cls} hover:bg-white/[0.02]`}
        onClick={(e) => {
          if (follow(p)) e.preventDefault();
        }}
      >
        {body}
      </a>
    </li>
  );
}

/** Recent pings, newest first (the helper keeps the list; MAX_PINGS shown). */
export default function Pings() {
  const pings = useDevStore((s) => s.pings);
  const clock = useMinuteClock();
  const now = clock?.getTime();
  return (
    <section aria-label="recent pings" data-section="pings">
      <SectionHead title="PINGS" />
      {pings.length === 0 ? (
        <p className="mt-[8px] text-[10.5px] text-dim">Nothing needs you.</p>
      ) : (
        <ul className="mt-[6px]">
          {pings.map((p) => (
            <Row key={p.id} p={p} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

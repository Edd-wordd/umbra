"use client";

import { CI_TONE } from "@/lib/dev/format";
import { useDevStore } from "@/lib/dev/store";
import type { CiRun } from "@/lib/dev/types";
import { Dot, SectionHead, TEXT_TONE } from "./ui";

function CiRow({ r }: { r: CiRun }) {
  const sentry = useDevStore((s) => (r.sentryId ? s.sentry[r.sentryId] : undefined));
  const open = useDevStore((s) => !!r.sentryId && s.sentryOpen === r.sentryId);
  const toggle = useDevStore((s) => s.toggleSentry);
  const tone = CI_TONE[r.status];
  const failed = r.status === "failed";
  return (
    <li data-ci={r.repo} className="py-[3px]">
      <div className="flex items-center gap-[8px] text-[10.5px] leading-[16px]">
        <Dot tone={tone} pulse={r.status === "running"} />
        <span className="shrink-0 text-ink">{r.repo}</span>
        <span className="shrink-0 tabular-nums text-dim">#{r.number}</span>
        <span className="min-w-0 truncate text-dim">{r.branch}</span>
        <span className={`ml-auto shrink-0 text-[10px] ${failed ? "text-broken" : r.status === "running" ? "text-active" : "text-mid"}`}>
          {r.status === "running" ? "running · " : ""}
          {r.summary}
        </span>
      </div>
      {failed && (
        <div className="pl-[13px]">
          {r.failing.map((t) => (
            <div key={t} className="truncate text-[10px] leading-[17px] text-broken/85">
              ✕ {t}
            </div>
          ))}
          {sentry && (
            <button
              type="button"
              onClick={() => toggle(sentry.id)}
              aria-expanded={open}
              className="group flex w-full items-center gap-[8px] text-left text-[10px] leading-[17px]"
            >
              <span className="text-attention">≈ matches sentry {sentry.id}</span>
              <span className="truncate text-dim">×{sentry.count24h} · 24h</span>
              <span className={`ml-auto shrink-0 group-hover:text-ink ${open ? "text-mid" : "text-dim"}`}>{open ? "excerpt ▸ shown" : "excerpt ▸"}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Build / CI per repo, linked to Sentry when a failure matches a live issue. */
export default function CiPanel() {
  const ci = useDevStore((s) => s.ci);
  const failing = ci.filter((r) => r.status === "failed").length;
  return (
    <section aria-label="build and ci">
      <SectionHead title="BUILD · CI" meta="github actions · sentry">
        {failing ? <span className={TEXT_TONE.broken}>{failing} red</span> : null}
      </SectionHead>
      <ul className="mt-[5px]">
        {ci.map((r) => (
          <CiRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}

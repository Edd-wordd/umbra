"use client";

import { useDevStore } from "@/lib/dev/store";
import { Btn, SectionHead } from "./ui";

/** Error excerpt for the Sentry issue a failing CI run / agent links to. Opens under the terminal. */
export default function SentryDrawer() {
  const issue = useDevStore((s) => (s.sentryOpen ? s.sentry[s.sentryOpen] : undefined));
  const run = useDevStore((s) => s.ci.find((r) => r.sentryId && r.sentryId === s.sentryOpen));
  const toggle = useDevStore((s) => s.toggleSentry);
  if (!issue) return null;
  return (
    <section aria-label={`sentry ${issue.id}`} className="umbra-fade-in shrink-0" data-sentry={issue.id}>
      <SectionHead title={`SENTRY · ${issue.id}`} meta={`${issue.project} · ×${issue.count24h} in 24h · first seen ${issue.firstSeen}`}>
        <Btn tone="quiet" onClick={() => toggle(issue.id)}>
          CLOSE
        </Btn>
      </SectionHead>
      <pre className="relative mt-[8px] overflow-x-auto border border-line bg-black/35 py-[8px] pl-[14px] pr-[10px] text-[10.5px] leading-[17px] text-mid">
        <span className="absolute -left-px top-[-1px] bottom-[-1px] w-px bg-broken/70" />
        {issue.excerpt.map((l, i) => (
          <div key={i} className={i === 0 ? "text-broken/90" : ""}>
            {l}
          </div>
        ))}
      </pre>
      {run && (
        <div className="mt-[6px] truncate text-[10px] text-dim">
          same frame as the <span className="text-mid">ci #{run.number}</span> failure · likely one fix
        </div>
      )}
    </section>
  );
}

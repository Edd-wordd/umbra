"use client";

import { AGENT_TONE, formatElapsed } from "@/lib/dev/format";
import { useDevStore } from "@/lib/dev/store";
import type { AgentSession } from "@/lib/dev/types";
import { useNow } from "@/lib/hooks/useNow";
import { Btn, Dot, SectionHead, TEXT_TONE } from "./ui";

function AgentRow({ a, selected, now }: { a: AgentSession; selected: boolean; now: number }) {
  const select = useDevStore((s) => s.select);
  const respond = useDevStore((s) => s.respondPrompt);
  const reviewDiff = useDevStore((s) => s.reviewDiff);

  const tone = AGENT_TONE[a.state];
  const elapsed = formatElapsed((a.endedAt ?? (now || a.startedAt)) - a.startedAt);

  let detail: React.ReactNode = <span className="truncate text-dim">{a.task}</span>;
  let actions: React.ReactNode = null;
  if (a.state === "waiting" && a.prompt) {
    detail = <span className="truncate text-attention/90">{a.prompt.title.toLowerCase()} prompt</span>;
    actions = (
      <>
        <Btn tone="attention" onClick={() => respond(a.id, "approve")} title={a.prompt.detail}>
          APPROVE
        </Btn>
        <Btn onClick={() => respond(a.id, "deny")}>DENY</Btn>
      </>
    );
  } else if (a.state === "done" && a.diff) {
    detail = <span className="truncate text-dim">{a.task}</span>;
    actions = (
      <>
        <span className="shrink-0 tabular-nums text-mid">
          +{a.diff.additions} −{a.diff.deletions}
        </span>
        <Btn onClick={() => reviewDiff(a.id)}>REVIEW DIFF</Btn>
      </>
    );
  } else if (a.state === "failed" && a.failure) {
    const sentryId = a.failure.sentryId;
    detail = <span className="truncate text-broken/85">✕ {a.failure.tests[0]?.split(" › ").pop() ?? a.failure.summary}</span>;
    actions = sentryId ? (
      <Btn
        onClick={() => {
          select(a.sessionId);
          useDevStore.setState({ expandedProject: a.repo, pickerFor: null });
        }}
        title={`linked sentry issue ${sentryId} · opens ${a.repo} services`}
      >
        ≈ {sentryId}
      </Btn>
    ) : (
      <span className="shrink-0 text-dim">{a.failure.summary}</span>
    );
  } else if (a.state === "stopped") {
    detail = <span className="truncate text-dim">exited · {a.task}</span>;
  }

  return (
    <li
      role="option"
      aria-selected={selected}
      data-agent={a.id}
      data-state={a.state}
      onClick={() => select(a.sessionId)}
      className={`relative cursor-pointer px-[12px] py-[6px] transition-colors ${selected ? "bg-panel-raised" : "hover:bg-panel-raised/50"}`}
    >
      {selected && <span className="absolute inset-y-[4px] left-0 w-[2px] bg-mid" />}
      <div className="flex items-center gap-[8px] text-[10.5px] leading-[16px]">
        <Dot tone={tone} pulse={a.state === "running"} />
        <span className="shrink-0 text-ink">{a.repo}</span>
        <span className="shrink-0 text-dim">{a.agent}</span>
        <span className="min-w-0 truncate text-dim">{a.branch}</span>
        <span className={`ml-auto shrink-0 text-[9.5px] tracking-[1px] ${TEXT_TONE[tone]}`}>
          {a.state === "waiting" ? "WAITING ON YOU" : a.state.toUpperCase()}
        </span>
        <span className="w-[40px] shrink-0 text-right text-[9.5px] tabular-nums text-dim">{elapsed}</span>
      </div>
      <div className="mt-[2px] flex h-[18px] items-center gap-[8px] pl-[13px] text-[10px]">
        {detail}
        {actions && <span className="ml-auto flex shrink-0 items-center gap-[6px]">{actions}</span>}
      </div>
    </li>
  );
}

/** Agent watch: every coding agent Edward has running, per repo, worst-first. */
export default function AgentWatch() {
  const agents = useDevStore((s) => s.agents);
  const selectedId = useDevStore((s) => s.selectedId);
  const now = useNow();
  return (
    <section aria-label="agent watch" className="flex min-h-[124px] shrink flex-col">
      <SectionHead title="AGENT WATCH" meta={`${agents.length} sessions · cursor / codex / pi`} />
      <ul role="listbox" aria-label="agents" className="-mx-[12px] mt-[6px] min-h-0 flex-1 overflow-y-auto">
        {agents.map((a) => (
          <AgentRow key={a.id} a={a} selected={a.sessionId === selectedId} now={now} />
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useDevStore } from "@/lib/dev/store";
import { SectionHead } from "./ui";

/** "Send to agent": one line of intent becomes a new agent session on its own branch. */
export default function Dispatch() {
  const repo = useDevStore((s) => s.dispatchRepo);
  const agent = useDevStore((s) => s.dispatchAgent);
  const cycleRepo = useDevStore((s) => s.cycleDispatchRepo);
  const cycleAgent = useDevStore((s) => s.cycleDispatchAgent);
  const dispatch = useDevStore((s) => s.dispatch);
  const [task, setTask] = useState("");

  return (
    <section aria-label="dispatch" className="shrink-0">
      <SectionHead title="SEND TO AGENT">
        <button type="button" onClick={cycleRepo} className="text-mid hover:text-ink" title="target repo (click to cycle)">
          {repo} ▾
        </button>
        <button type="button" onClick={cycleAgent} className="text-mid hover:text-ink" title="agent (click to cycle)">
          {agent} ▾
        </button>
      </SectionHead>
      <form
        className="mt-[8px] flex h-[30px] items-center gap-[10px] border border-line px-[10px] focus-within:border-line-strong"
        onSubmit={(e) => {
          e.preventDefault();
          if (!task.trim()) return;
          dispatch(task);
          setTask("");
        }}
      >
        <span className="text-[12px] leading-none text-dim">›</span>
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              e.currentTarget.blur();
            }
          }}
          placeholder="fix that lint error on a branch"
          aria-label="send to agent"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-ink caret-active outline-none placeholder:text-ghost"
        />
        <span className="text-[9.5px] text-ghost">⏎ send</span>
      </form>
    </section>
  );
}

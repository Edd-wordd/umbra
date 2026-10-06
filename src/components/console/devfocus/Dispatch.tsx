"use client";

import { useEffect, useRef, useState } from "react";
import { useDevStore } from "@/lib/dev/store";

/** "Send to agent": one quiet line; a sentence becomes a new agent session on its own branch. */
export default function Dispatch() {
  const repo = useDevStore((s) => s.dispatchRepo);
  const agent = useDevStore((s) => s.dispatchAgent);
  const cycleRepo = useDevStore((s) => s.cycleDispatchRepo);
  const cycleAgent = useDevStore((s) => s.cycleDispatchAgent);
  const dispatch = useDevStore((s) => s.dispatch);
  const focusAt = useDevStore((s) => s.dispatchFocusAt);
  const [task, setTask] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusAt) input.current?.focus();
  }, [focusAt]);

  return (
    <form
      aria-label="dispatch"
      className="flex h-[28px] shrink-0 items-center gap-[8px] border-b border-line text-[10px] focus-within:border-line-strong"
      onSubmit={(e) => {
        e.preventDefault();
        if (!task.trim()) return;
        dispatch(task);
        setTask("");
      }}
    >
      <span className="w-[10px] text-[12px] leading-none text-ghost">›</span>
      <input
        ref={input}
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            e.currentTarget.blur();
          }
        }}
        placeholder="send to agent…"
        aria-label="send to agent"
        spellCheck={false}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[10.5px] text-ink caret-active outline-none placeholder:text-ghost"
      />
      <button type="button" onClick={cycleRepo} className="text-dim hover:text-ink" title="target repo (click to cycle)">
        {repo}
      </button>
      <span className="text-ghost">·</span>
      <button type="button" onClick={cycleAgent} className="text-dim hover:text-ink" title="agent (click to cycle)">
        {agent}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_TONE, SERVER_TONE, shortCwd } from "@/lib/dev/format";
import { useDevStore } from "@/lib/dev/store";
import type { TermLine } from "@/lib/dev/types";
import { approvePending, denyPending } from "./approval";
import { ApprovalStrip, Dot, TEXT_TONE } from "./ui";

const LINE_TONE: Record<TermLine["kind"], string> = {
  cmd: "text-ink",
  out: "text-mid",
  dim: "text-dim",
  ok: "text-mid",
  warn: "text-attention/90",
  err: "text-broken/90",
  sys: "text-ink",
};

function Line({ l }: { l: TermLine }) {
  if (l.kind === "cmd") {
    const i = l.text.indexOf(" ❯ ");
    if (i >= 0)
      return (
        <div className="whitespace-pre-wrap break-words">
          <span className="text-dim">{l.text.slice(0, i)}</span>
          <span className="text-active/80"> ❯ </span>
          <span className="text-ink">{l.text.slice(i + 3)}</span>
        </div>
      );
  }
  return <div className={`min-h-[1.6em] whitespace-pre-wrap break-words ${LINE_TONE[l.kind]}`}>{l.text}</div>;
}

/** Read-only transcript of the selected session + a sample command line. Plain DOM, no xterm. */
export default function Terminal() {
  const selectedId = useDevStore((s) => s.selectedId);
  const sessions = useDevStore((s) => s.sessions);
  const session = sessions[selectedId];
  const agent = useDevStore((s) => s.agents.find((a) => a.sessionId === s.selectedId));
  const server = useDevStore((s) => s.servers.find((x) => x.sessionId === s.selectedId));
  const pending = useDevStore((s) => s.pending);
  const runCommand = useDevStore((s) => s.runCommand);
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIndex, setHIndex] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const lines = session?.lines ?? [];
  const lastId = lines.at(-1)?.id;
  const held = pending?.origin === "terminal" ? pending : null;
  const heldElsewhere = held && held.sessionId !== selectedId ? sessions[held.sessionId ?? ""]?.title : null;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, selectedId, held]);

  if (!session) return null;

  const tone = agent ? AGENT_TONE[agent.state] : server ? SERVER_TONE[server.state] : "dim";
  const stateLabel = agent ? (agent.state === "waiting" ? "waiting on you" : agent.state) : server ? server.state : "";
  const repo = session.cwd.split("/").pop();

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (held) {
      const v = cmd.trim().toLowerCase();
      if (e.key === "Escape" || (e.key === "Enter" && (v === "n" || v === "no"))) {
        e.preventDefault();
        e.stopPropagation();
        setCmd("");
        denyPending();
      } else if (e.key === "Enter" && (v === "y" || v === "yes")) {
        e.preventDefault();
        setCmd("");
        void approvePending();
      } else if (e.key === "Enter") {
        e.preventDefault();
      }
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      e.currentTarget.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!cmd.trim()) return;
      runCommand(cmd);
      setHistory((h) => [...h.filter((x) => x !== cmd.trim()), cmd.trim()].slice(-30));
      setHIndex(null);
      setCmd("");
    } else if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const i = hIndex === null ? history.length - 1 : Math.max(0, hIndex - 1);
      setHIndex(i);
      setCmd(history[i]);
    } else if (e.key === "ArrowDown" && hIndex !== null) {
      e.preventDefault();
      const i = hIndex + 1;
      setHIndex(i >= history.length ? null : i);
      setCmd(i >= history.length ? "" : history[i]);
    }
  }

  return (
    <section aria-label="terminal" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[16px] items-center gap-[10px] text-[9.5px] leading-none">
        <span className="tracking-[2px] text-mid">TERMINAL</span>
        <span className="shrink-0 whitespace-nowrap text-ink">{session.title}</span>
        <span className="min-w-0 truncate text-dim">
          {shortCwd(session.cwd)} · {session.branch}
        </span>
        <span className={`ml-auto flex shrink-0 items-center gap-[6px] tracking-[1px] ${TEXT_TONE[tone]}`}>
          <Dot tone={tone} />
          {stateLabel.toUpperCase()}
        </span>
      </div>
      <div className="mt-[8px] flex min-h-0 flex-1 flex-col border border-line bg-black/35">
        <div
          ref={scroller}
          onClick={() => window.getSelection()?.isCollapsed && input.current?.focus()}
          className="min-h-0 flex-1 cursor-text select-text overflow-y-auto px-[14px] py-[10px] text-[11px] leading-[1.6]"
          data-terminal={selectedId}
        >
          {lines.length === 0 && <div className="text-ghost">(empty · type help)</div>}
          {lines.map((l) => (
            <Line key={l.id} l={l} />
          ))}
        </div>
        {held && (
          <div className="px-[10px] pb-[8px]">
            <ApprovalStrip
              command={held.command}
              reason={heldElsewhere ? `${held.reason} · in ${heldElsewhere}` : held.reason}
              hint="y ⏎ · esc"
              onApprove={() => void approvePending()}
              onDeny={denyPending}
            />
          </div>
        )}
        <label className="flex h-[34px] shrink-0 items-center gap-[8px] border-t border-line px-[14px] text-[11px]">
          <span className="max-w-[45%] shrink-0 truncate text-dim">
            {repo} {session.branch}
          </span>
          <span className="text-active/80">❯</span>
          <input
            ref={input}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="terminal command"
            placeholder={held ? "y to approve · n / esc to deny" : "type a command · sample shell, nothing runs"}
            className="min-w-0 flex-1 bg-transparent text-ink caret-active outline-none placeholder:text-ghost"
          />
        </label>
      </div>
    </section>
  );
}

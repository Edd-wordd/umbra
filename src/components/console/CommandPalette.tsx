"use client";

import { useState } from "react";
import { useUmbra } from "@/lib/store";
import { needsApproval, runTool, searchTools, type Risk, type Tool } from "@/lib/tools";

const BADGE: Record<Risk, string | null> = { read: null, confirm: "CONFIRM", physical: "APPROVAL" };

/**
 * Cmd-K palette: typed fallback to voice. Lists tools from the shared tool
 * layer; risky tools go through an explicit approval step before running.
 * The only modal surface allowed; the console dims but does not change state.
 */
export default function CommandPalette() {
  const open = useUmbra((s) => s.paletteOpen);
  if (!open) return null;
  return <Palette />;
}

function Palette() {
  const query = useUmbra((s) => s.paletteQuery);
  const setQuery = useUmbra((s) => s.setPaletteQuery);
  const close = useUmbra((s) => s.closePalette);
  const lastResult = useUmbra((s) => s.lastResult);
  const setLastResult = useUmbra((s) => s.setLastResult);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<Tool | null>(null);
  const [running, setRunning] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const results = searchTools(query);
  const sel = Math.min(index, Math.max(0, results.length - 1));

  async function execute(tool: Tool, approved: boolean) {
    const { wakeRail, setMode, toIdle } = useUmbra.getState();
    setRunning(true);
    const res = await runTool(tool, { source: "palette", approved, wakeRail, setMode, toIdle });
    setRunning(false);
    setPending(null);
    setLastResult(res);
    if (res.ok && tool.risk === "read") close();
  }

  function choose(tool: Tool | undefined) {
    if (!tool || running) return;
    if (needsApproval(tool)) setPending(tool);
    else void execute(tool, false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (pending) setPending(null);
      else close();
      return;
    }
    if (pending) {
      if (e.key === "Enter") {
        e.preventDefault();
        void execute(pending, true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((sel + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((sel - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[sel]);
    }
  }

  const showResult = lastResult && lastResult.at >= openedAt;

  return (
    <div
      className="absolute inset-0 z-40 bg-black/55"
      data-keep-rail
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="command palette"
        className="umbra-pop absolute left-1/2 top-[230px] w-[720px] max-w-[calc(100%-48px)] -translate-x-1/2 border border-line-strong bg-panel"
        onKeyDown={onKeyDown}
      >
        <span className="glow-active absolute -top-px left-0 right-0 h-px bg-active/70" />
        <div className="flex h-[62px] items-center gap-[14px] border-b border-line px-[22px]">
          <span className="text-[18px] leading-none text-active">›</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder="type a tool or ask…"
            aria-label="command"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-normal text-ink caret-active outline-none placeholder:text-ghost"
          />
          <span className="text-[10px] text-dim">⌘K</span>
        </div>

        {pending ? (
          <div className="border-l-2 border-attention px-[22px] py-[18px]">
            <div className="text-[9.5px] tracking-[2px] text-attention">
              APPROVAL REQUIRED · {pending.risk.toUpperCase()} · {pending.id}
            </div>
            <div className="mt-[10px] text-[16px] font-normal text-ink">{pending.title}</div>
            <div className="mt-[16px] flex gap-[12px] text-[10px] tracking-[2px]">
              <button
                type="button"
                autoFocus
                disabled={running}
                onClick={() => void execute(pending, true)}
                className="border border-attention px-[18px] py-[7px] text-attention hover:bg-attention/10"
              >
                CONFIRM ⏎
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="border border-ghost px-[18px] py-[7px] text-dim hover:text-ink"
              >
                CANCEL esc
              </button>
            </div>
          </div>
        ) : (
          <ul role="listbox" aria-label="tools" className="py-[4px]">
            {results.length === 0 && <li className="px-[22px] py-[12px] text-[11px] text-dim">no matching tool</li>}
            {results.map((t, i) => {
              const active = i === sel;
              const badge = BADGE[t.risk];
              return (
                <li
                  key={t.id}
                  role="option"
                  aria-selected={active}
                  onPointerEnter={() => setIndex(i)}
                  onClick={() => choose(t)}
                  className={`relative flex h-[40px] cursor-pointer items-center px-[22px] text-[11px] ${active ? "bg-panel-raised" : ""}`}
                >
                  {active && <span className="glow-active absolute inset-y-[3px] left-0 w-[2px] bg-active" />}
                  <span className={`w-[208px] shrink-0 truncate ${active ? "text-active" : "text-mid"}`}>{t.id}</span>
                  <span className={`truncate ${active ? "text-ink" : "text-dim"}`}>{t.title}</span>
                  {badge && (
                    <span
                      className={`ml-auto w-[78px] shrink-0 border border-attention py-[2px] text-center text-[9px] tracking-[1px] text-attention ${
                        active ? "" : "opacity-50"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex h-[42px] items-center justify-between border-t border-line px-[22px] text-[9.5px] text-dim">
          <span>{pending ? "⏎ confirm   esc cancel" : "↑↓ select   ⏎ run   esc close"}</span>
          {showResult ? (
            <span className={lastResult.ok ? "text-mid" : "text-attention"}>{lastResult.message}</span>
          ) : (
            <span>same tool layer as voice + buttons</span>
          )}
        </div>
      </div>
    </div>
  );
}

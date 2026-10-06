"use client";

import { useState } from "react";
import { useUmbra } from "@/lib/store";
import { DOMAIN_CODE, type DomainId } from "@/lib/graph";
import { needsApproval, runTool, searchTools, type Risk, type Tool } from "@/lib/tools";
import { Glyph } from "../ui/Glyph";

const BADGE: Record<Risk, string | null> = { read: null, confirm: "CONFIRM", physical: "APPROVAL" };
const codeOf = (id: string) => DOMAIN_CODE[id.split(".")[0] as DomainId] ?? id.slice(0, 3).toUpperCase();

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
      className="absolute inset-0 z-40 bg-black/60"
      data-keep-rail
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="command palette"
        className="umbra-pop umbra-scan absolute left-1/2 top-[230px] w-[720px] max-w-[calc(100%-48px)] -translate-x-1/2 border border-line-strong bg-panel"
        onKeyDown={onKeyDown}
      >
        <span className="absolute -top-px left-0 h-[2px] w-[96px] bg-active" />
        <div className="flex h-[62px] items-center gap-[14px] border-b border-line px-[22px]">
          <span className="label text-active">CMD</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder="TYPE A TOOL OR ASK…"
            aria-label="command"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-normal tracking-[0.06em] text-ink caret-active outline-none placeholder:text-[11px] placeholder:tracking-[0.24em] placeholder:text-ghost"
          />
          <Glyph code="⌘K" size="md" />
        </div>

        {pending ? (
          <div className="border-l-2 border-attention px-[22px] py-[18px]">
            <div className="label text-attention">
              APPROVAL REQUIRED <span className="ml-[10px] text-mid">{pending.risk.toUpperCase()}</span>{" "}
              <span className="ml-[10px] normal-case tracking-[0.06em] text-dim">{pending.id}</span>
            </div>
            <div className="mt-[10px] text-[16px] font-normal text-ink">{pending.title}</div>
            <div className="label mt-[16px] flex gap-[12px] text-[9px]">
              <button
                type="button"
                autoFocus
                disabled={running}
                onClick={() => void execute(pending, true)}
                className="border border-active bg-active px-[18px] py-[7px] text-black hover:bg-ink"
              >
                CONFIRM ⏎
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="border border-ghost px-[18px] py-[7px] text-dim hover:border-mid hover:text-ink"
              >
                CANCEL esc
              </button>
            </div>
          </div>
        ) : (
          <ul role="listbox" aria-label="tools" className="py-[4px]">
            {results.length === 0 && <li className="label px-[22px] py-[14px] text-dim">NO MATCHING TOOL</li>}
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
                  className={`relative flex h-[38px] cursor-pointer items-center gap-[14px] px-[22px] text-[11px] ${active ? "bg-panel-raised" : ""}`}
                >
                  {active && <span className="absolute inset-y-[3px] left-0 w-[2px] bg-active" />}
                  <Glyph code={codeOf(t.id)} state={active ? "active" : "idle"} className="w-[30px]" />
                  <span className={`w-[190px] shrink-0 truncate text-[10.5px] tracking-[0.04em] ${active ? "text-active" : "text-mid"}`}>{t.id}</span>
                  <span className={`label truncate text-[8.5px] tracking-[0.18em] ${active ? "text-ink" : "text-dim"}`}>{t.title}</span>
                  {badge && (
                    <span
                      className={`label ml-auto w-[78px] shrink-0 border py-[3px] text-center text-[8px] ${
                        t.risk === "physical" ? "border-attention/80 text-attention" : "border-line-strong text-mid"
                      } ${active ? "" : "opacity-60"}`}
                    >
                      {badge}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="label flex h-[40px] items-center justify-between border-t border-line px-[22px] text-[8px] text-ghost">
          <span className="whitespace-pre">{pending ? "⏎ CONFIRM   ESC CANCEL" : "↑↓ SELECT   ⏎ RUN   ESC CLOSE"}</span>
          {showResult ? (
            <span className={lastResult.ok ? "text-mid" : "text-attention"}>{lastResult.message}</span>
          ) : (
            <span>SAME TOOL LAYER AS VOICE + BUTTONS</span>
          )}
        </div>
      </div>
    </div>
  );
}

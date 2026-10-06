"use client";

import { getRail } from "@/lib/rails";
import { useDevStore } from "@/lib/dev/store";
import { useUmbra } from "@/lib/store";
import ActivityLog from "./ActivityLog";
import Dispatch from "./Dispatch";
import Handoff from "./Handoff";
import NeedsYou from "./NeedsYou";
import ProjectDrawer from "./ProjectDrawer";
import Projects from "./Projects";
import Servers from "./Servers";
import Terminal from "./Terminal";
import { DEV_FOCUS, devFocusWidthCss } from "./layout";
import { useAllServiceViews } from "./useServiceViews";

const pct = (y: number) => `${((y / 1080) * 100).toFixed(3)}%`;

/** Left column: needs first, then one line per project, then everything else folded. */
function Overview() {
  const views = useAllServiceViews();
  return (
    <>
      <Handoff />
      <NeedsYou views={views} />
      <Projects views={views} />
      <Servers />
      <div className="mt-auto pt-[10px]">
        <Dispatch />
      </div>
    </>
  );
}

/** Right column: the terminal and project details appear only when asked for. */
function Detail() {
  const hasTerminal = useDevStore((s) => !!s.sessions[s.selectedId]);
  const hasProject = useDevStore((s) => s.expandedProject !== null);
  if (!hasTerminal && !hasProject)
    return (
      <div className="flex flex-1 items-center justify-center text-[10px] text-ghost" data-detail-empty>
        pick a line on the left · its terminal or services open here
      </div>
    );
  return (
    <>
      <Terminal />
      <ProjectDrawer />
    </>
  );
}

/**
 * Dev focus: the Dev rail expanded into a workspace (agents, terminal, ports,
 * CI, hand-off, dispatch, activity). Docked to the DEV tick like every rail
 * panel; stays awake while open (Esc or the DEV tick closes it).
 */
export default function DevFocus() {
  const toIdle = useUmbra((s) => s.toIdle);
  const mock = useDevStore((s) => s.mock);
  const handoffOpen = useDevStore((s) => s.handoffOpen);
  const setHandoff = useDevStore((s) => s.setHandoff);
  const rail = getRail("dev");
  const labelEnd = 26 + rail.label.length * 8 + 6;

  return (
    <>
      <div
        className="pointer-events-none absolute h-px bg-active/60"
        style={{ top: pct(rail.y), left: labelEnd, width: DEV_FOCUS.left - labelEnd }}
      />
      <section
        data-keep-rail
        data-panel="dev"
        data-focus="dev"
        aria-label="dev focus"
        // First interaction outside the "left off" card folds it.
        onClickCapture={(e) => {
          if (handoffOpen && !(e.target as Element).closest("[data-handoff]")) setHandoff(false);
        }}
        className="umbra-slide-left absolute flex flex-col border border-line bg-panel"
        style={{ left: DEV_FOCUS.left, top: DEV_FOCUS.top, bottom: DEV_FOCUS.bottom, width: devFocusWidthCss }}
      >
        <span className="glow-active absolute -left-px top-[-1px] bottom-[-1px] w-px bg-active/70" />
        <header className="flex h-[48px] shrink-0 items-center justify-between px-5">
          <h2 className="text-[12px] font-normal tracking-[4px] text-active">DEV · FOCUS</h2>
          <div className="flex items-center gap-[16px] text-[10px]">
            {!handoffOpen && (
              <button type="button" onClick={() => setHandoff(true)} className="text-dim hover:text-ink" title="where you left off (⌘K: Where I left off)">
                left off ↺
              </button>
            )}
            <span className="border border-attention/50 px-[6px] py-[2px] text-[9.5px] tracking-[2px] text-attention/80">
              SAMPLE{mock === "quiet" ? " · QUIET" : ""}
            </span>
            <button type="button" onClick={toIdle} className="text-dim hover:text-ink" aria-label="close dev focus">
              esc ✕
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 border-t border-line">
          <div className="flex w-[46%] min-w-[400px] max-w-[480px] shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-line px-5 py-[16px]">
            <Overview />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[14px] px-5 py-[16px]">
            <Detail />
          </div>
        </div>

        <ActivityLog />
      </section>
    </>
  );
}

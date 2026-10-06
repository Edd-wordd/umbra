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
import { useGlitch } from "@/lib/hooks/useGlitch";

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

/** True when something is selected: the detail panel slides open. */
export const useDetailOpen = () => useDevStore((s) => !!s.sessions[s.selectedId] || s.expandedProject !== null);

/** Detail panel: terminal and/or project cards, only while something is selected. */
function Detail() {
  const hasTerminal = useDevStore((s) => !!s.sessions[s.selectedId]);
  const hasProject = useDevStore((s) => s.expandedProject !== null);
  if (!hasTerminal && !hasProject) return null;
  return (
    <>
      <Terminal />
      <ProjectDrawer />
    </>
  );
}

/**
 * Dev focus: the Dev rail expanded into a workspace. By default a slim column
 * beside a large core; selecting a need, project, agent or server slides the
 * detail panel open (transform/opacity only). Stays awake while open (Esc or
 * the DEV tick closes it).
 */
export default function DevFocus() {
  const toIdle = useUmbra((s) => s.toIdle);
  const mock = useDevStore((s) => s.mock);
  const handoffOpen = useDevStore((s) => s.handoffOpen);
  const setHandoff = useDevStore((s) => s.setHandoff);
  const open = useDetailOpen();
  const scan = useGlitch<HTMLElement>(open ? 1 : 0, "umbra-scan");
  const rail = getRail("dev");
  const labelEnd = 26 + rail.label.length * 8 + 6;
  const frame = { top: DEV_FOCUS.top, bottom: DEV_FOCUS.bottom };

  return (
    <div
      data-keep-rail
      data-focus="dev"
      data-detail={open ? "open" : "closed"}
      // First interaction outside the "left off" card folds it.
      onClickCapture={(e) => {
        if (handoffOpen && !(e.target as Element).closest("[data-handoff]")) setHandoff(false);
      }}
    >
      <div className="pointer-events-none absolute h-px bg-active/50" style={{ top: pct(rail.y), left: labelEnd, width: DEV_FOCUS.left - labelEnd }} />
      <section
        data-panel="dev"
        aria-label="dev focus"
        className="umbra-slide-left absolute z-10 flex flex-col border border-line bg-panel"
        style={{ ...frame, left: DEV_FOCUS.left, width: DEV_FOCUS.slim }}
      >
        <span className="glow-active absolute -left-px top-[-1px] bottom-[-1px] w-px bg-active/80" />
        <header className="flex h-[46px] shrink-0 items-center justify-between px-5">
          <h2 className="label font-normal tracking-[0.42em] text-active">DEV · FOCUS</h2>
          <div className="flex items-center gap-[14px]">
            {!handoffOpen && (
              <button type="button" onClick={() => setHandoff(true)} className="label text-dim hover:text-ink" title="where you left off (⌘K: Where I left off)">
                LEFT OFF
              </button>
            )}
            <span className="label border border-line-strong px-[5px] py-[3px] text-dim">SAMPLE{mock === "quiet" ? " · QUIET" : ""}</span>
            <button type="button" onClick={toIdle} className="label text-dim hover:text-ink" aria-label="close dev focus">
              ESC
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto border-t border-line px-5 py-[18px]">
          <Overview />
        </div>
        <ActivityLog />
      </section>

      <aside
        aria-label="dev detail"
        aria-hidden={!open}
        className={`absolute flex flex-col gap-[14px] border border-l-0 border-line bg-panel px-5 py-[16px] transition-[transform,opacity] duration-[240ms] ease-[var(--umbra-ease)] ${
          open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[18px] opacity-0"
        }`}
        ref={scan}
        style={{ ...frame, left: DEV_FOCUS.left + DEV_FOCUS.slim, width: `calc(${devFocusWidthCss} - ${DEV_FOCUS.slim}px)` }}
      >
        <Detail />
      </aside>
    </div>
  );
}

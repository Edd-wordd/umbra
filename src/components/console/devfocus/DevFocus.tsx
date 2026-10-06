"use client";

import { getRail } from "@/lib/rails";
import { useDevStore } from "@/lib/dev/store";
import { useUmbra } from "@/lib/store";
import { formatClock } from "@/lib/time";
import ActivityLog from "./ActivityLog";
import AgentWatch from "./AgentWatch";
import CiPanel from "./CiPanel";
import Dispatch from "./Dispatch";
import Handoff from "./Handoff";
import SentryDrawer from "./SentryDrawer";
import Servers from "./Servers";
import Terminal from "./Terminal";
import { DEV_FOCUS, devFocusWidthCss } from "./layout";

const pct = (y: number) => `${((y / 1080) * 100).toFixed(3)}%`;

function Summary() {
  const agents = useDevStore((s) => s.agents);
  const c = (st: string) => agents.filter((a) => a.state === st).length;
  const parts: { n: number; label: string; cls: string }[] = [
    { n: c("running"), label: "running", cls: "text-active" },
    { n: c("waiting"), label: "waiting", cls: "text-attention" },
    { n: c("failed"), label: "failed", cls: "text-broken" },
    { n: c("done"), label: "done", cls: "text-mid" },
  ];
  return (
    <span className="flex gap-[14px] text-[9.5px]">
      {parts
        .filter((p) => p.n > 0)
        .map((p) => (
          <span key={p.label} className="text-dim">
            <span className={p.cls}>{p.n}</span> {p.label}
          </span>
        ))}
    </span>
  );
}

/**
 * Dev focus: the Dev rail expanded into a workspace (agents, terminal, ports,
 * CI, hand-off, dispatch, activity). Docked to the DEV tick like every rail
 * panel; stays awake while open (Esc or the DEV tick closes it).
 */
export default function DevFocus() {
  const since = useUmbra((s) => s.since);
  const toIdle = useUmbra((s) => s.toIdle);
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
        className="umbra-slide-left absolute flex flex-col border border-line bg-panel"
        style={{ left: DEV_FOCUS.left, top: DEV_FOCUS.top, bottom: DEV_FOCUS.bottom, width: devFocusWidthCss }}
      >
        <span className="glow-active absolute -left-px top-[-1px] bottom-[-1px] w-px bg-active/70" />
        <header className="flex items-start justify-between px-5 pb-[12px] pt-[16px]">
          <div>
            <div className="flex items-baseline gap-[18px]">
              <h2 className="text-[12px] font-normal tracking-[4px] text-active">DEV · FOCUS</h2>
              <Summary />
            </div>
            <p className="mt-[8px] text-[9.5px] text-dim">
              opened {formatClock(new Date(since))} · stays awake while open · esc closes · ⌘K for dev tools
            </p>
          </div>
          <div className="flex items-center gap-[14px]">
            <span className="border border-attention/50 px-[6px] py-[2px] text-[9.5px] tracking-[2px] text-attention/80">SAMPLE DATA</span>
            <button type="button" onClick={toIdle} className="text-[10px] text-dim hover:text-ink" aria-label="close dev focus">
              esc ✕
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 border-t border-line">
          <div className="flex w-[41%] min-w-[360px] max-w-[430px] shrink-0 flex-col gap-[13px] overflow-y-auto border-r border-line px-5 py-[13px] [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-[13px]">
            <AgentWatch />
            <Dispatch />
            <Servers />
            <CiPanel />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[14px] px-5 py-[14px]">
            <Handoff />
            <Terminal />
            <SentryDrawer />
          </div>
        </div>

        <ActivityLog />
      </section>
    </>
  );
}

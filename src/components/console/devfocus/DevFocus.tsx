"use client";

import { getRail } from "@/lib/rails";
import { useDevStore } from "@/lib/dev/store";
import { useUmbra } from "@/lib/store";
import Pings from "./Pings";
import ProjectDrawer from "./ProjectDrawer";
import Projects from "./Projects";
import { DEV_FOCUS, devFocusWidthCss } from "./layout";

const pct = (y: number) => `${((y / 1080) * 100).toFixed(3)}%`;

/** Before the helper's snapshot: one quiet line, never sample data. */
function NotLive() {
  const helper = useDevStore((s) => s.helper);
  if (helper.state === "connecting") return <p className="text-[10.5px] text-dim" data-state="connecting">connecting to the mac helper…</p>;
  return (
    <p className="text-[10.5px] text-dim" data-state={helper.state} title={helper.error}>
      Mac helper not connected · start it with <code className="text-mid">pnpm helper</code>
    </p>
  );
}

/** Live tag in the header: present only while the helper is connected. */
function LinkTag() {
  const helper = useDevStore((s) => s.helper);
  if (helper.state !== "live") return null;
  return (
    <span
      className="whitespace-nowrap border border-active/40 px-[6px] py-[2px] text-[9.5px] tracking-[2px] text-active/80"
      data-bridge="live"
      title={`mac helper on ${helper.hostname ?? "the mac"} · herdr ${helper.herdr ?? "?"}${helper.gh ? ` · gh ${helper.gh}` : ""}`}
    >
      LIVE · MAC
    </span>
  );
}

/**
 * Dev focus: recent pings and one line per project, from the Mac helper.
 * Clicking a project slides a small drawer open beside the column. Stays
 * awake while open (Esc or the DEV tick closes it).
 */
export default function DevFocus() {
  const toIdle = useUmbra((s) => s.toIdle);
  const live = useDevStore((s) => s.live);
  const open = useDevStore((s) => s.expandedProject !== null);
  const rail = getRail("dev");
  const labelEnd = 26 + rail.label.length * 8 + 6;
  const frame = { top: DEV_FOCUS.top, bottom: DEV_FOCUS.bottom };

  return (
    <div data-keep-rail data-focus="dev" data-detail={open ? "open" : "closed"} data-live={live ? "yes" : "no"}>
      <div className="pointer-events-none absolute h-px bg-active/60" style={{ top: pct(rail.y), left: labelEnd, width: DEV_FOCUS.left - labelEnd }} />
      <section
        data-panel="dev"
        aria-label="dev focus"
        className="umbra-slide-left absolute z-10 flex flex-col border border-line bg-panel"
        style={{ ...frame, left: DEV_FOCUS.left, width: DEV_FOCUS.slim }}
      >
        <span className="glow-active absolute -left-px top-[-1px] bottom-[-1px] w-px bg-active/70" />
        <header className="flex h-[48px] shrink-0 items-center justify-between px-5">
          <h2 className="whitespace-nowrap text-[12px] font-normal tracking-[4px] text-active">DEV · FOCUS</h2>
          <div className="flex items-center gap-[16px] text-[10px]">
            <LinkTag />
            <button type="button" onClick={toIdle} className="text-dim hover:text-ink" aria-label="close dev focus">
              esc ✕
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto border-t border-line px-5 py-[16px]">
          {live ? (
            <>
              <Pings />
              <Projects />
            </>
          ) : (
            <NotLive />
          )}
        </div>
      </section>

      <aside
        aria-label="project detail"
        aria-hidden={!open}
        className={`absolute flex flex-col border border-l-0 border-line bg-panel px-5 py-[16px] transition-[translate,opacity] duration-[240ms] ease-[var(--umbra-ease)] ${
          open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[18px] opacity-0"
        }`}
        style={{ ...frame, left: DEV_FOCUS.left + DEV_FOCUS.slim, width: `calc(${devFocusWidthCss} - ${DEV_FOCUS.slim}px)` }}
      >
        <ProjectDrawer />
      </aside>
    </div>
  );
}

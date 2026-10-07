"use client";

import { useState } from "react";
import { useDevStore } from "@/lib/dev/store";
import { useMinuteClock } from "@/lib/hooks/useClock";
import type { DevProject } from "@/lib/dev/projects";
import { SERVICES, STATUS_TONE, worstStatus, type ServiceStatus } from "@/lib/dev/services";
import type { AgentSession } from "@/lib/dev/types";
import { useTriageStore } from "@/lib/decide/store";
import type { SignalKind } from "@/lib/dev/signals";
import { AccentBar, Btn, Chip, Dot, LocalLink, SectionHead } from "./ui";
import type { ServiceItem } from "./useServiceViews";

function Picker({ project }: { project: DevProject }) {
  const add = useDevStore((s) => s.addService);
  const close = () => useDevStore.getState().openPicker(null);
  const unused = SERVICES.filter((a) => !project.services.includes(a.id));
  const [hover, setHover] = useState(unused[0]?.id);
  const blurb = unused.find((a) => a.id === hover)?.blurb;
  return (
    <div
      className="umbra-pop mb-[4px] ml-[25px] mr-[12px] border-l border-line-strong py-[4px] pl-[10px]"
      data-picker={project.repo}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-[6px] text-[9.5px]">
        <span className="text-dim">attach</span>
        {unused.length === 0 && <span className="text-ghost">every registered service is attached</span>}
        {unused.map((a) => (
          <span key={a.id} onPointerEnter={() => setHover(a.id)} onFocus={() => setHover(a.id)}>
            <Btn onClick={() => add(project.repo, a.id)} title={a.blurb}>
              + {a.label}
            </Btn>
          </span>
        ))}
        <span className="ml-auto">
          <Btn tone="quiet" onClick={close}>
            ESC
          </Btn>
        </span>
      </div>
      {blurb && <div className="mt-[4px] truncate text-[9.5px] text-dim">{blurb}</div>}
    </div>
  );
}

const AGENT_STATUS: Record<AgentSession["state"], ServiceStatus> = { running: "ok", waiting: "attention", idle: "ok", failed: "broken", done: "ok", stopped: "ok" };

/** Short chip labels for streamed events the decision layer placed on the project row. */
const SIGNAL_CHIP: Partial<Record<SignalKind, string>> = {
  "ci.failed": "ci",
  "agent.done": "review",
  "container.restarts": "docker",
  "sentry.spike": "sentry",
  "unpushed.stale": "unpushed",
  "posthog.spike": "traffic",
  "deps.update": "deps",
};

function ProjectRow({ project, items }: { project: DevProject; items: ServiceItem[] }) {
  const triaged = useTriageStore((s) => s.signals);
  const decisions = useTriageStore((s) => s.decisions);
  const expanded = useDevStore((s) => s.expandedProject === project.repo);
  const picking = useDevStore((s) => s.pickerFor === project.repo);
  const agents = useDevStore((s) => s.agents);
  const servers = useDevStore((s) => s.servers);
  const toggle = useDevStore((s) => s.toggleProject);
  const openPicker = useDevStore((s) => s.openPicker);
  const select = useDevStore((s) => s.select);

  const live = useDevStore((s) => s.bridgeMode === "live");
  const mine = agents.filter((a) => a.repo === project.repo);
  const running = mine.filter((a) => a.state === "running" || (live && a.state === "waiting"));
  // Live (Herdr): agents sitting ready show as one quiet marker per kind.
  // Agents from both of a repo's Herdr workspaces stay apart ("cursor ws 1", "cursor ws 6").
  const ready = live ? groupBy(mine.filter((a) => a.state === "idle" || a.state === "done"), (a) => (a.where ? `${a.agent} ${a.where}` : a.agent)) : [];
  const review = mine.find((a) => a.state === "done" && a.diff);
  const flagged = items.filter((i) => i.view.status === "attention" || i.view.status === "broken");
  const activeSvc = items.find((i) => i.view.status === "active");
  const gh = items.find((i) => i.adapter.id === "github");
  // Gray unless something needs him; running work is a cyan marker, not a color change.
  const worst = worstStatus(["ok", ...flagged.map((i) => i.view.status), ...mine.map((a) => AGENT_STATUS[a.state])]);
  const ports = servers.filter((s) => s.repo === project.repo && (s.state === "running" || s.state === "starting"));
  // Streamed events triaged to "chip": visible here, not in Needs you.
  const chips = triaged.filter((x) => !x.needKey && x.repo === project.repo && decisions[x.id]?.placement === "chip");

  const summary = review?.diff
    ? { text: `${review.agent} done · +${review.diff.additions} −${review.diff.deletions} to review`, cls: "text-mid" }
    : activeSvc
      ? { text: activeSvc.view.summary, cls: "text-active/80" }
      : flagged.length
        ? null
        : { text: gh?.view.summary ?? items[0]?.view.summary ?? "no services", cls: "text-dim" };

  return (
    <li data-project={project.repo} className="group">
      <div
        onClick={() => toggle(project.repo)}
        aria-expanded={expanded}
        className={`relative flex h-[26px] cursor-pointer items-center gap-[8px] px-[12px] text-[10.5px] transition-colors ${
          expanded ? "bg-panel-raised" : "hover:bg-panel-raised/50"
        }`}
      >
        {expanded && <span className="absolute inset-y-[4px] left-0 w-[2px] bg-mid" />}
        <Dot tone={STATUS_TONE[worst]} />
        <AccentBar repo={project.repo} />
        <span
          className="flex w-[96px] shrink-0 items-baseline gap-[4px] truncate text-ink"
          title={project.workspaces?.length ? `${project.path} · Herdr workspace${project.workspaces.length > 1 ? "s" : ""} ${project.workspaces.join(", ")}${project.agentStatus ? ` · ${project.agentStatus}` : ""}` : project.path}
        >
          <span className="truncate">{project.label ?? project.repo}</span>
          {(project.workspaces?.length ?? 0) > 1 && <span className="shrink-0 text-[9px] text-ghost">×{project.workspaces!.length}</span>}
        </span>
        {flagged.map(({ adapter, view }) => (
          <Chip
            key={adapter.id}
            label={adapter.chip}
            tone={STATUS_TONE[view.status]}
            title={`${adapter.label} · ${view.summary}`}
            onClick={() => !expanded && toggle(project.repo)}
          />
        ))}
        {chips.map((x) => (
          <Chip
            key={x.id}
            label={SIGNAL_CHIP[x.kind] ?? x.source}
            tone={x.tone === "broken" ? "attention" : "mid"}
            title={`${x.title} · ${decisions[x.id].reason} · triaged to project`}
          />
        ))}
        {summary && <span className={`min-w-0 truncate text-[10px] ${summary.cls}`}>{summary.text}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-[10px]">
          {running.map((a) => (
            <button
              key={a.id}
              type="button"
              data-agent-marker={a.id}
              title={`${a.agent} ${a.state === "waiting" ? "waiting on you" : "running"}${a.task ? ` · ${a.task}` : ""}${a.note ? ` · ${a.note}` : ""} · open its session`}
              onClick={(e) => {
                e.stopPropagation();
                select(a.sessionId);
              }}
              className={`flex items-center gap-[5px] text-[9.5px] ${a.state === "waiting" ? "text-attention/90 hover:text-attention" : "text-active/90 hover:text-active"}`}
            >
              <Dot tone={a.state === "waiting" ? "attention" : "active"} pulse={a.state === "running"} />
              {a.agent}
              {a.where && <span className="text-ghost">{a.where}</span>}
            </button>
          ))}
          {ready.map(([kind, list]) => (
            <button
              key={kind}
              type="button"
              data-agent-marker={list[0].id}
              title={`${list.map((a) => `${a.agent} ${a.state}${a.note ? ` · ${a.note}` : ""}`).join("\n")} · open its session`}
              onClick={(e) => {
                e.stopPropagation();
                select(list[0].sessionId);
              }}
              className="flex items-center gap-[5px] text-[9.5px] text-dim hover:text-mid"
            >
              <Dot tone="dim" />
              {kind}
              {list.length > 1 && <span className="text-ghost">×{list.length}</span>}
            </button>
          ))}
          {ports.map((s) => (
            <span key={s.id} className="flex items-center gap-[3px]">
              <button
                type="button"
                title={`${s.command} · pid ${s.pid} · open its log`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (s.sessionId) select(s.sessionId);
                }}
                className="text-[9.5px] tabular-nums text-active/70 hover:text-active"
              >
                :{s.port}
              </button>
              {s.state === "running" && <LocalLink port={s.port} short />}
            </span>
          ))}
          <button
            type="button"
            aria-label={`add service to ${project.repo}`}
            title="attach a service"
            onClick={(e) => {
              e.stopPropagation();
              openPicker(picking ? null : project.repo);
            }}
            className={`w-[10px] text-[11px] leading-none transition-opacity ${
              picking ? "text-ink opacity-100" : "text-ghost opacity-0 hover:text-mid focus-visible:opacity-100 group-hover:opacity-100"
            }`}
          >
            +
          </button>
        </span>
      </div>
      {picking && <Picker project={project} />}
    </li>
  );
}

function groupBy<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m.entries()];
}

const ago = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
};

/** One line per project: gray when healthy, a chip only for services that need attention. Live: one per repo open in Herdr. */
export default function Projects({ views }: { views: Record<string, ServiceItem[]> }) {
  const projects = useDevStore((s) => s.projects);
  const recent = useDevStore((s) => s.recentProjects);
  const live = useDevStore((s) => s.bridgeMode === "live");
  const herdr = useDevStore((s) => s.helper.herdr);
  const fromHerdr = live && !!herdr && !herdr.startsWith("off");
  const now = useMinuteClock()?.getTime() ?? 0;
  return (
    <section aria-label="projects" className="shrink-0">
      <SectionHead
        title="PROJECTS"
        meta={
          <>
            {projects.length}
            {live && <span className="text-ghost"> · {fromHerdr ? "open in herdr" : "fallback list"}</span>}
          </>
        }
      />
      <ul className="-mx-[12px] mt-[6px]">
        {projects.length === 0 && <li className="px-[12px] text-[10px] text-dim">no Herdr workspaces open on a repo</li>}
        {projects.map((p) => (
          <ProjectRow key={p.repo} project={p} items={views[p.repo] ?? []} />
        ))}
      </ul>
      {recent.length > 0 && (
        <div className="mt-[4px] truncate pl-[13px] text-[9.5px] text-ghost" data-recent title="Herdr workspaces closed recently">
          recent · {recent.map((r) => `${r.label ?? r.repo} ${now ? ago(now - r.lastSeen) : ""}`).join(" · ")}
        </div>
      )}
    </section>
  );
}

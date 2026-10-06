"use client";

import { useState } from "react";
import { useDevStore } from "@/lib/dev/store";
import type { DevProject } from "@/lib/dev/projects";
import { SERVICES, STATUS_TONE, worstStatus, type ServiceStatus } from "@/lib/dev/services";
import type { AgentSession } from "@/lib/dev/types";
import { Btn, Chip, Dot, SectionHead } from "./ui";
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

const AGENT_STATUS: Record<AgentSession["state"], ServiceStatus> = { running: "ok", waiting: "attention", failed: "broken", done: "ok", stopped: "ok" };

function ProjectRow({ project, items }: { project: DevProject; items: ServiceItem[] }) {
  const expanded = useDevStore((s) => s.expandedProject === project.repo);
  const picking = useDevStore((s) => s.pickerFor === project.repo);
  const agents = useDevStore((s) => s.agents);
  const servers = useDevStore((s) => s.servers);
  const toggle = useDevStore((s) => s.toggleProject);
  const openPicker = useDevStore((s) => s.openPicker);
  const select = useDevStore((s) => s.select);

  const mine = agents.filter((a) => a.repo === project.repo);
  const running = mine.filter((a) => a.state === "running");
  const review = mine.find((a) => a.state === "done" && a.diff);
  const flagged = items.filter((i) => i.view.status === "attention" || i.view.status === "broken");
  const activeSvc = items.find((i) => i.view.status === "active");
  const gh = items.find((i) => i.adapter.id === "github");
  // Gray unless something needs him; running work is a cyan marker, not a color change.
  const worst = worstStatus(["ok", ...flagged.map((i) => i.view.status), ...mine.map((a) => AGENT_STATUS[a.state])]);
  const ports = servers.filter((s) => s.repo === project.repo && (s.state === "running" || s.state === "starting"));

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
        <span className="w-[96px] shrink-0 truncate text-ink">{project.repo}</span>
        {flagged.map(({ adapter, view }) => (
          <Chip
            key={adapter.id}
            label={adapter.chip}
            tone={STATUS_TONE[view.status]}
            title={`${adapter.label} · ${view.summary}`}
            onClick={() => !expanded && toggle(project.repo)}
          />
        ))}
        {summary && <span className={`min-w-0 truncate text-[10px] ${summary.cls}`}>{summary.text}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-[10px]">
          {running.map((a) => (
            <button
              key={a.id}
              type="button"
              data-agent-marker={a.id}
              title={`${a.agent} running · ${a.task} · open its session`}
              onClick={(e) => {
                e.stopPropagation();
                select(a.sessionId);
              }}
              className="flex items-center gap-[5px] text-[9.5px] text-active/90 hover:text-active"
            >
              <Dot tone="active" pulse />
              {a.agent}
            </button>
          ))}
          {ports.map((s) => (
            <button
              key={s.id}
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

/** One line per project: gray when healthy, a chip only for services that need attention. */
export default function Projects({ views }: { views: Record<string, ServiceItem[]> }) {
  const projects = useDevStore((s) => s.projects);
  return (
    <section aria-label="projects" className="shrink-0">
      <SectionHead title="PROJECTS" meta={String(projects.length)} />
      <ul className="-mx-[12px] mt-[6px]">
        {projects.map((p) => (
          <ProjectRow key={p.repo} project={p} items={views[p.repo] ?? []} />
        ))}
      </ul>
    </section>
  );
}

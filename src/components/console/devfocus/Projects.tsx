"use client";

import { useState } from "react";
import { useDevStore } from "@/lib/dev/store";
import type { DevProject } from "@/lib/dev/projects";
import { SERVICES, STATUS_TONE, worstStatus } from "@/lib/dev/services";
import { Btn, Chip, Dot, SectionHead } from "./ui";
import { useServiceViews } from "./useServiceViews";

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

function ProjectRow({ project }: { project: DevProject }) {
  const expanded = useDevStore((s) => s.expandedProject === project.repo);
  const picking = useDevStore((s) => s.pickerFor === project.repo);
  const servers = useDevStore((s) => s.servers);
  const toggle = useDevStore((s) => s.toggleProject);
  const openPicker = useDevStore((s) => s.openPicker);
  const items = useServiceViews(project);
  const worst = worstStatus(items.map((i) => i.view.status));
  const ports = servers.filter((s) => s.repo === project.repo && (s.state === "running" || s.state === "starting"));
  const open = () => !expanded && toggle(project.repo);

  return (
    <li data-project={project.repo}>
      <div
        onClick={() => toggle(project.repo)}
        aria-expanded={expanded}
        className={`relative flex h-[28px] cursor-pointer items-center gap-[8px] px-[12px] text-[10.5px] transition-colors ${
          expanded ? "bg-panel-raised" : "hover:bg-panel-raised/50"
        }`}
      >
        {expanded && <span className="absolute inset-y-[4px] left-0 w-[2px] bg-mid" />}
        <Dot tone={STATUS_TONE[worst]} />
        <span className="w-[104px] shrink-0 truncate text-ink">{project.repo}</span>
        <span className="flex min-w-0 items-center gap-[4px] overflow-hidden">
          {items.map(({ adapter, view }) => (
            <Chip key={adapter.id} label={adapter.chip} tone={STATUS_TONE[view.status]} title={`${adapter.label} · ${view.summary}`} onClick={open} />
          ))}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-[8px]">
          {ports.map((s) => (
            <span key={s.id} className="text-[9.5px] tabular-nums text-active/80" title={`${s.command} · pid ${s.pid}`}>
              :{s.port}
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
            className={`text-[10px] ${picking ? "text-ink" : "text-ghost hover:text-mid"}`}
          >
            + service
          </button>
        </span>
      </div>
      {picking && <Picker project={project} />}
    </li>
  );
}

/** One compact row per project; chips only for the services that project uses. */
export default function Projects() {
  const projects = useDevStore((s) => s.projects);
  return (
    <section aria-label="projects" className="shrink-0">
      <SectionHead title="PROJECTS" meta={`${projects.length} repos · services per project`} />
      <ul className="-mx-[12px] mt-[6px]">
        {projects.map((p) => (
          <ProjectRow key={p.repo} project={p} />
        ))}
      </ul>
    </section>
  );
}

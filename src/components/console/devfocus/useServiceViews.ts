"use client";

import { useDevStore } from "@/lib/dev/store";
import type { DevProject } from "@/lib/dev/projects";
import { getService, readService, type ServiceAdapter, type ServiceContext, type ServicePayloads, type ServiceView } from "@/lib/dev/services";
import { useNow } from "@/lib/hooks/useNow";

export interface ServiceItem {
  adapter: ServiceAdapter;
  view: ServiceView;
}

/** Render every service a project uses through its adapter. Pure; cheap enough to run per second. */
export function viewsFor(project: DevProject, payloads: ServicePayloads, ctx: Omit<ServiceContext, "project">): ServiceItem[] {
  return project.services.flatMap((id) => {
    const adapter = getService(id);
    return adapter ? [{ adapter, view: readService(adapter, payloads, { ...ctx, project }) }] : [];
  });
}

function useCtx() {
  const ci = useDevStore((s) => s.ci);
  const servers = useDevStore((s) => s.servers);
  const agents = useDevStore((s) => s.agents);
  const now = useNow();
  return { ci, servers, agents, now };
}

export function useServiceViews(project: DevProject): ServiceItem[] {
  const payloads = useDevStore((s) => s.services);
  return viewsFor(project, payloads, useCtx());
}

/** Service views for every configured project, keyed by repo. */
export function useAllServiceViews(): Record<string, ServiceItem[]> {
  const payloads = useDevStore((s) => s.services);
  const projects = useDevStore((s) => s.projects);
  const ctx = useCtx();
  return Object.fromEntries(projects.map((p) => [p.repo, viewsFor(p, payloads, ctx)]));
}

"use client";

import { useDevStore } from "@/lib/dev/store";
import type { DevProject } from "@/lib/dev/projects";
import { getService, readService, type ServiceAdapter, type ServiceView } from "@/lib/dev/services";
import { useNow } from "@/lib/hooks/useNow";

export interface ServiceItem {
  adapter: ServiceAdapter;
  view: ServiceView;
}

/** Render every service a project uses through its adapter (cheap; recomputed per second for ages). */
export function useServiceViews(project: DevProject): ServiceItem[] {
  const payloads = useDevStore((s) => s.services);
  const ci = useDevStore((s) => s.ci);
  const servers = useDevStore((s) => s.servers);
  const agents = useDevStore((s) => s.agents);
  const now = useNow();
  const ctx = { project, ci, servers, agents, now };
  return project.services.flatMap((id) => {
    const adapter = getService(id);
    return adapter ? [{ adapter, view: readService(adapter, payloads, ctx) }] : [];
  });
}

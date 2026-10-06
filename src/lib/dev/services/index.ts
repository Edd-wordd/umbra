import { docker } from "./docker";
import { figma } from "./figma";
import { github } from "./github";
import { posthog } from "./posthog";
import { sentry } from "./sentry";
import { supabase } from "./supabase";
import type { ServiceAdapter, ServiceContext, ServiceId, ServiceNeed, ServicePayloads, ServiceView } from "./types";

export * from "./types";

/**
 * Registered service adapters. Adding a service = one adapter file in this
 * folder + one entry here (+ its sample payload in src/lib/mock/services.ts
 * until the bridge serves real data).
 */
export const SERVICES: readonly ServiceAdapter[] = [github, sentry, posthog, supabase, docker, figma];

export const getService = (id: ServiceId): ServiceAdapter | undefined => SERVICES.find((s) => s.id === id);

/** What a rendered service asks of Edward (explicit `needs`, else derived from an attention/broken status). */
export function needsOf(view: ServiceView): ServiceNeed[] {
  if (view.needs) return view.needs;
  if (view.fyi || (view.status !== "attention" && view.status !== "broken")) return [];
  return [{ tone: view.status, text: view.summary }];
}

/** Render one service for one project. */
export function readService(adapter: ServiceAdapter, payloads: ServicePayloads, ctx: ServiceContext): ServiceView {
  return adapter.read(payloads[adapter.id]?.[ctx.project.repo], ctx);
}

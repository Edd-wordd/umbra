import { actionRequiresApproval } from "../actions/policy";
import type { ActionContext } from "../actions/types";
import type { BrainPipelineResult } from "../brain/pipeline";
import { getNode } from "../brain/graph";
import type { BrainNode } from "../brain/types";
import { eventsForEntity } from "../memory/timeline";
import { runbooksForSituation } from "../runbooks";
import { actionsForSituation } from "../situations/actions";
import { activeSituations } from "../situations/lifecycle";
import type { OpsNeed, OpsNeedAction } from "./types";

const DEFAULT_CONTEXT: ActionContext = {
  source: "system",
  actor: "umbra",
  approved: false,
};

export async function buildOpsNeeds(result: BrainPipelineResult, ctx: ActionContext = DEFAULT_CONTEXT): Promise<OpsNeed[]> {
  const needs = await Promise.all(activeSituations(result.situations).map((situation) => buildNeed(result, situation, ctx)));
  return needs.filter((need) => need.actions.length || need.runbooks.length || need.situation.needsHuman);
}

async function buildNeed(result: BrainPipelineResult, situation: BrainPipelineResult["situations"][number], ctx: ActionContext): Promise<OpsNeed> {
  const entities = situation.entities.map((id) => getNode(result.graph, id)).filter(Boolean) as OpsNeed["entities"];
  const bindings = actionsForSituation(situation);
  const actions: OpsNeedAction[] = await Promise.all(
    bindings.map(async ({ action, label }) => ({
      id: action.id,
      label,
      risk: action.risk,
      requiresApproval: actionRequiresApproval(action),
      plan: await action.dryRun({ ...ctx, args: inferArgs(situation, entities) }),
    })),
  );
  const memory = situation.entities.flatMap((entity) => eventsForEntity(result.memory, entity));
  return {
    id: situation.id,
    title: situation.title,
    severity: situation.severity,
    whyNow: situation.whyNow,
    situation,
    entities,
    runbooks: runbooksForSituation(situation),
    actions,
    memory,
  };
}

function inferArgs(situation: BrainPipelineResult["situations"][number], entities: BrainNode[]): Record<string, string> {
  const args: Record<string, string> = { situationId: situation.id };
  if (entities[0]) args.entityId = entities[0].id;

  const job = entities.find((entity) => entity.type === "job");
  if (job) {
    args.jobId = job.id;
    args.imageId = job.id;
  }

  const session = entities.find((entity) => entity.type === "session");
  if (session) args.sessionId = session.id;

  const device = entities.find((entity) => entity.type === "device");
  if (device) args.deviceId = device.id;

  const port =
    entities.find((entity) => typeof entity.meta?.port === "number")?.meta?.port ??
    situation.summary.match(/:(\d{2,5})|port\s+(\d{2,5})/i)?.[1] ??
    situation.whyNow.match(/port\s+(\d{2,5})/i)?.[1];
  if (port) args.port = String(port);

  const pid = entities.find((entity) => typeof entity.meta?.pid === "number")?.meta?.pid;
  if (pid) args.pid = String(pid);

  return args;
}

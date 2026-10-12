import { createQuietSampleBrain, createSampleBrain } from "../brain/sample";
import { buildOpsNeeds } from "./needs";
import type { OpsNeed } from "./types";

export async function createSampleOpsNeeds(now = Date.now()): Promise<OpsNeed[]> {
  return buildOpsNeeds(createSampleBrain(now));
}

export async function createQuietSampleOpsNeeds(now = Date.now()): Promise<OpsNeed[]> {
  return buildOpsNeeds(createQuietSampleBrain(now));
}

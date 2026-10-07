import { createDevSnapshot } from "../mock/dev";
import { buildBrainFromDevSnapshot, type BrainPipelineResult } from "./pipeline";

export function createSampleBrain(now = Date.now()): BrainPipelineResult {
  return buildBrainFromDevSnapshot(createDevSnapshot(now), now);
}

export function createQuietSampleBrain(now = Date.now()): BrainPipelineResult {
  return buildBrainFromDevSnapshot(createDevSnapshot(now, "quiet"), now);
}

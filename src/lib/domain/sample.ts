import { createSampleAstroSnapshot } from "../astro";
import { createSampleBusinessSnapshot } from "../business";
import { createSampleCamerasSnapshot } from "../cameras";
import { createSampleLabSnapshot } from "../lab";
import { createDevSnapshot } from "../mock/dev";
import { createSamplePrintSnapshot } from "../print";
import { ASTRO_DOMAIN_ADAPTER } from "./astro";
import { BUSINESS_DOMAIN_ADAPTER } from "./business";
import { CAMERAS_DOMAIN_ADAPTER } from "./cameras";
import { DEV_DOMAIN_ADAPTER } from "./dev";
import { KNOWLEDGE_DOMAIN_ADAPTER, createSampleKnowledgeSnapshot } from "./knowledge";
import { LAB_DOMAIN_ADAPTER } from "./lab";
import { OPS_DOMAIN_ADAPTER, createSampleOpsSnapshot } from "./ops";
import { buildMultiDomainPipeline } from "./multi";
import { PRINT_DOMAIN_ADAPTER } from "./print";

export function createSampleMultiDomainBrain(now = Date.now()) {
  return buildMultiDomainPipeline(
    [
      { adapter: DEV_DOMAIN_ADAPTER, snapshot: createDevSnapshot(now) },
      { adapter: LAB_DOMAIN_ADAPTER, snapshot: createSampleLabSnapshot(now) },
      { adapter: PRINT_DOMAIN_ADAPTER, snapshot: createSamplePrintSnapshot(now) },
      { adapter: ASTRO_DOMAIN_ADAPTER, snapshot: createSampleAstroSnapshot(now) },
      { adapter: BUSINESS_DOMAIN_ADAPTER, snapshot: createSampleBusinessSnapshot(now) },
      { adapter: CAMERAS_DOMAIN_ADAPTER, snapshot: createSampleCamerasSnapshot(now) },
      { adapter: KNOWLEDGE_DOMAIN_ADAPTER, snapshot: createSampleKnowledgeSnapshot() },
      { adapter: OPS_DOMAIN_ADAPTER, snapshot: createSampleOpsSnapshot() },
    ],
    now,
  );
}

export * from "./types";
export * from "./policy";
export * from "./run";
export * from "./dev";
export * from "./print";
export * from "./astro";
export * from "./lab";
export * from "./business";
export * from "./knowledge";
export * from "./cameras";
export * from "./ops";

import { ASTRO_ACTIONS } from "./astro";
import { BUSINESS_ACTIONS } from "./business";
import { CAMERAS_ACTIONS } from "./cameras";
import { DEV_ACTIONS } from "./dev";
import { KNOWLEDGE_ACTIONS } from "./knowledge";
import { LAB_ACTIONS } from "./lab";
import { OPS_ACTIONS } from "./ops";
import { PRINT_ACTIONS } from "./print";
import type { UmbraAction } from "./types";

export const ACTIONS: readonly UmbraAction[] = [...DEV_ACTIONS, ...PRINT_ACTIONS, ...ASTRO_ACTIONS, ...LAB_ACTIONS, ...BUSINESS_ACTIONS, ...KNOWLEDGE_ACTIONS, ...CAMERAS_ACTIONS, ...OPS_ACTIONS];

export function getAction(id: string): UmbraAction | undefined {
  return ACTIONS.find((action) => action.id === id);
}

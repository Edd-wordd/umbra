export * from "./types";
export * from "./policy";
export * from "./run";
export * from "./dev";

import { DEV_ACTIONS } from "./dev";
import type { UmbraAction } from "./types";

export const ACTIONS: readonly UmbraAction[] = [...DEV_ACTIONS];

export function getAction(id: string): UmbraAction | undefined {
  return ACTIONS.find((action) => action.id === id);
}

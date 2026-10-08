import { DEV_DOMAIN_ADAPTER } from "./dev";

import { ASTRO_DOMAIN_ADAPTER } from "./astro";
import { BUSINESS_DOMAIN_ADAPTER } from "./business";
import { CAMERAS_DOMAIN_ADAPTER } from "./cameras";
import { KNOWLEDGE_DOMAIN_ADAPTER } from "./knowledge";
import { LAB_DOMAIN_ADAPTER } from "./lab";
import { OPS_DOMAIN_ADAPTER } from "./ops";
import { PRINT_DOMAIN_ADAPTER } from "./print";
import type { DomainAdapter } from "./types";

export const DOMAIN_ADAPTERS = [
  DEV_DOMAIN_ADAPTER,
  LAB_DOMAIN_ADAPTER,
  PRINT_DOMAIN_ADAPTER,
  ASTRO_DOMAIN_ADAPTER,
  BUSINESS_DOMAIN_ADAPTER,
  CAMERAS_DOMAIN_ADAPTER,
  KNOWLEDGE_DOMAIN_ADAPTER,
  OPS_DOMAIN_ADAPTER,
] as const;

export function getDomainAdapter(id: string): DomainAdapter<unknown> | undefined {
  return DOMAIN_ADAPTERS.find((adapter) => adapter.id === id) as DomainAdapter<unknown> | undefined;}

import type { DevSnapshot } from "../dev/types";
import { devSnapshotToBrainGraph } from "../brain/dev-adapter";
import { deriveDevSituations } from "../situations/dev";
import type { DomainAdapter } from "./types";

export const DEV_DOMAIN_ADAPTER: DomainAdapter<DevSnapshot> = {
  id: "dev",
  label: "Dev",
  toGraph: devSnapshotToBrainGraph,
  deriveSituations: (graph, _snapshot, now) => deriveDevSituations(graph, now),
};

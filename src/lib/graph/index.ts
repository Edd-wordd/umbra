export * from "./types";
export { sampleGraph } from "./sample";
export {
  computeCoreLayout,
  polar,
  sectorAngle,
  RADII,
  SECTOR_ORDER,
  SECTOR_WIDTH,
  type CoreLayout,
  type PlacedNode,
  type Sector,
  type Chord,
  type Tier,
} from "./layout";

import { sampleGraph } from "./sample";
import { computeCoreLayout } from "./layout";

/** Layout of the sample graph, computed once at module load. */
export const sampleLayout = computeCoreLayout(sampleGraph);

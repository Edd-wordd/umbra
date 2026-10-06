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

export { computeTileLayout, DOMAIN_CODE, TILE_R, type Tile, type TileLayout, type Thread, type District } from "./tiles";

import { sampleGraph } from "./sample";
import { computeTileLayout } from "./tiles";

/** Tile ("data city") layout of the sample graph, computed once at module load. */
export const sampleTiles = computeTileLayout(sampleGraph);

# Umbra Brain

Typed operational graph for Umbra.

This is not the visual R3F brain. It is the machine-readable graph that the visual brain, situations, actions, memory, agents, and Obsidian indexer will use.

## Current flow

```txt
DevSnapshot
→ devSnapshotToBrainGraph()
→ BrainGraph
→ createBrainSnapshot()
→ deriveDevSituations()
→ attention/domain summaries
```

Use:

```ts
import { buildBrainFromDevSnapshot } from "@/lib/brain";
```

For sample data:

```ts
import { createSampleBrain, createQuietSampleBrain } from "@/lib/brain";
```

## Principles

- Obsidian is an authoring layer, not the graph database.
- Agents should receive traversal results, not raw vault dumps.
- Every durable entity needs a stable ID.
- Edges are typed and semantic.
- Live bridge state wins over note state for operational decisions.

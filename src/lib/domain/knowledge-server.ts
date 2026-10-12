import "server-only";

import { indexObsidianVault } from "../knowledge/fs-indexer";
import type { BrainGraph } from "../brain/types";
import type { Situation } from "../situations/types";

export interface LiveKnowledgeDomainResult {
  configured: boolean;
  graph: BrainGraph;
  situations: Situation[];
  accepted: number;
  rejected: number;
  rejectedSamples: Array<{ path: string; reason: string }>;
  error?: string;
}

export async function getLiveKnowledgeDomain(now = Date.now()): Promise<LiveKnowledgeDomainResult> {
  const vaultPath = process.env.UMBRA_OBSIDIAN_VAULT;
  if (!vaultPath) return empty(false, "UMBRA_OBSIDIAN_VAULT is not configured");

  try {
    const result = await indexObsidianVault({ vaultPath, vaultName: process.env.UMBRA_OBSIDIAN_VAULT_NAME, maxFiles: 1000 });
    const situations = result.rejected.slice(0, 20).map(({ note, reason }) => ({
      id: `situation:knowledge:note_untyped:${note.path}`,
      type: "note_untyped" as const,
      title: `${note.path} needs structure`,
      status: "active" as const,
      severity: "watch" as const,
      confidence: 0.9,
      entities: [`note:obsidian:${note.vault}:${note.path}`],
      signals: [],
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      summary: reason,
      whyNow: `note cannot become trusted graph memory: ${reason}`,
      suggestedActions: [
        { id: "knowledge.note.open", label: "Open note", risk: "read" },
        { id: "knowledge.note.structure", label: "Structure note", risk: "prepare" },
      ],
      needsHuman: false,
    } satisfies Situation));

    return {
      configured: true,
      graph: result.graph,
      situations,
      accepted: result.accepted.length,
      rejected: result.rejected.length,
      rejectedSamples: result.rejected.slice(0, 10).map(({ note, reason }) => ({ path: note.path, reason })),
    };
  } catch (error) {
    return empty(true, error instanceof Error ? error.message : "unknown error");
  }
}

function empty(configured: boolean, error?: string): LiveKnowledgeDomainResult {
  return { configured, graph: { nodes: [], edges: [] }, situations: [], accepted: 0, rejected: 0, rejectedSamples: [], error };
}

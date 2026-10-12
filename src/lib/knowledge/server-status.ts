import "server-only";

import { indexObsidianVault } from "./fs-indexer";

export interface KnowledgeIndexStatus {
  configured: boolean;
  accepted?: number;
  rejected?: number;
  graph?: { nodes: number; edges: number };
  memory?: number;
  rejectedSamples?: Array<{ path: string; reason: string }>;
  error?: string;
}

export async function getKnowledgeIndexStatus(): Promise<KnowledgeIndexStatus> {
  const vaultPath = process.env.UMBRA_OBSIDIAN_VAULT;
  if (!vaultPath) return { configured: false, error: "UMBRA_OBSIDIAN_VAULT is not configured" };

  try {
    const result = await indexObsidianVault({ vaultPath, vaultName: process.env.UMBRA_OBSIDIAN_VAULT_NAME, maxFiles: 1000 });
    return {
      configured: true,
      accepted: result.accepted.length,
      rejected: result.rejected.length,
      graph: { nodes: result.graph.nodes.length, edges: result.graph.edges.length },
      memory: result.memory.length,
      rejectedSamples: result.rejected.slice(0, 10).map(({ note, reason }) => ({ path: note.path, reason })),
    };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : "unknown error" };
  }
}

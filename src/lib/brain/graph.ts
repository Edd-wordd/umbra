import type {
  BrainEdge,
  BrainEdgeType,
  BrainGraph,
  BrainNode,
  GraphPath,
  GraphPathOptions,
  GraphTraversalOptions,
} from "./types";

const edgeKey = (edge: BrainEdge) => edge.id ?? `${edge.from}:${edge.type}:${edge.to}`;

export function createGraph(nodes: BrainNode[] = [], edges: BrainEdge[] = []): BrainGraph {
  return { nodes: upsertNodes([], nodes), edges: upsertEdges([], edges) };
}

export function upsertNodes(current: BrainNode[], next: BrainNode[]): BrainNode[] {
  const map = new Map(current.map((node) => [node.id, node]));
  for (const node of next) map.set(node.id, { ...map.get(node.id), ...node });
  return [...map.values()];
}

export function upsertEdges(current: BrainEdge[], next: BrainEdge[]): BrainEdge[] {
  const map = new Map(current.map((edge) => [edgeKey(edge), edge]));
  for (const edge of next) map.set(edgeKey(edge), { ...map.get(edgeKey(edge)), ...edge });
  return [...map.values()];
}

export function getNode(graph: BrainGraph, id: string): BrainNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

export function neighbors(graph: BrainGraph, entityId: string, options: GraphTraversalOptions = {}): BrainNode[] {
  const depth = options.depth ?? 1;
  const ids = traverseIds(graph, entityId, depth, options.edgeTypes, options.direction ?? "both");
  ids.delete(entityId);
  return graph.nodes.filter((node) => ids.has(node.id));
}

export function relatedEdges(
  graph: BrainGraph,
  entityId: string,
  direction: "out" | "in" | "both" = "both",
  edgeTypes?: readonly BrainEdgeType[],
): BrainEdge[] {
  return graph.edges.filter((edge) => {
    if (edgeTypes && !edgeTypes.includes(edge.type)) return false;
    if (direction === "out") return edge.from === entityId;
    if (direction === "in") return edge.to === entityId;
    return edge.from === entityId || edge.to === entityId;
  });
}

export function shortestPath(graph: BrainGraph, from: string, to: string, options: GraphPathOptions = {}): GraphPath | undefined {
  const maxDepth = options.maxDepth ?? 4;
  const direction = options.direction ?? "both";
  const queue: Array<{ id: string; nodeIds: string[]; edgeKeys: string[] }> = [{ id: from, nodeIds: [from], edgeKeys: [] }];
  const seen = new Set<string>([from]);
  const edgeByKey = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));

  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    if (item.id === to) {
      const nodes = item.nodeIds.map((id) => getNode(graph, id)).filter(Boolean) as BrainNode[];
      const edges = item.edgeKeys.map((key) => edgeByKey.get(key)).filter(Boolean) as BrainEdge[];
      return { nodes, edges };
    }
    if (item.edgeKeys.length >= maxDepth) continue;

    for (const edge of relatedEdges(graph, item.id, direction, options.edgeTypes)) {
      const nextId = edge.from === item.id ? edge.to : edge.from;
      if (seen.has(nextId)) continue;
      seen.add(nextId);
      queue.push({ id: nextId, nodeIds: [...item.nodeIds, nextId], edgeKeys: [...item.edgeKeys, edgeKey(edge)] });
    }
  }

  return undefined;
}

function traverseIds(
  graph: BrainGraph,
  start: string,
  depth: number,
  edgeTypes: readonly BrainEdgeType[] | undefined,
  direction: "out" | "in" | "both",
): Set<string> {
  const seen = new Set<string>([start]);
  let frontier = new Set<string>([start]);

  for (let level = 0; level < depth; level++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const edge of relatedEdges(graph, id, direction, edgeTypes)) {
        const target = edge.from === id ? edge.to : edge.from;
        if (!seen.has(target)) {
          seen.add(target);
          next.add(target);
        }
      }
    }
    frontier = next;
    if (!frontier.size) break;
  }

  return seen;
}

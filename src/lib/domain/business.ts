import type { BrainEdge, BrainGraph, BrainNode } from "../brain/types";
import type { BusinessDeal, BusinessLead, BusinessSnapshot } from "../business/types";
import type { Situation } from "../situations/types";
import type { DomainAdapter } from "./types";

export const BUSINESS_DOMAIN_ADAPTER: DomainAdapter<BusinessSnapshot> = {
  id: "business",
  label: "Business",
  toGraph: businessSnapshotToGraph,
  deriveSituations: deriveBusinessSituations,
};

function businessSnapshotToGraph(snapshot: BusinessSnapshot, now: number): BrainGraph {
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];
  for (const lead of snapshot.leads) addLead(nodes, lead, now);
  for (const deal of snapshot.deals) addDeal(nodes, edges, deal, now);
  for (const appointment of snapshot.appointments) {
    nodes.push({ id: appointment.id, type: "job", label: appointment.title, domain: "business", status: "fyi", source: "business", updatedAt: now, meta: { at: appointment.at } });
    if (appointment.leadId) edges.push({ from: appointment.leadId, to: appointment.id, type: "related_to", source: "business", updatedAt: now });
  }
  return { nodes, edges };
}

function addLead(nodes: BrainNode[], lead: BusinessLead, now: number) {
  nodes.push({
    id: lead.id,
    type: "lead",
    label: lead.name,
    domain: "business",
    status: lead.status === "warm" || lead.status === "new" ? "judgment" : lead.status === "stalled" ? "watch" : "silent",
    source: "business",
    updatedAt: now,
    meta: { company: lead.company ?? null, status: lead.status, value: lead.value ?? null, proposalViews: lead.proposalViews ?? 0, followupDrafted: !!lead.followupDrafted },
  });
}

function addDeal(nodes: BrainNode[], edges: BrainEdge[], deal: BusinessDeal, now: number) {
  nodes.push({
    id: deal.id,
    type: "job",
    label: deal.title,
    domain: "business",
    status: deal.stage === "proposal" ? "watch" : "silent",
    source: "business",
    updatedAt: now,
    meta: { stage: deal.stage, value: deal.value ?? null },
  });
  edges.push({ from: deal.leadId, to: deal.id, type: "owns", source: "business", updatedAt: now });
}

function deriveBusinessSituations(graph: BrainGraph, _snapshot: BusinessSnapshot, now: number): Situation[] {
  return graph.nodes.flatMap((node) => {
    if (node.domain !== "business" || node.type !== "lead") return [];
    const views = typeof node.meta?.proposalViews === "number" ? node.meta.proposalViews : 0;
    const drafted = !!node.meta?.followupDrafted;
    if (views >= 2 && !drafted) {
      return [
        {
          id: `situation:business:lead_followup:${node.id}`,
          type: "lead_needs_followup",
          sourceTypes: ["proposal_viewed"],
          title: `${node.label} needs follow-up`,
          status: "active",
          severity: "judgment",
          confidence: 0.85,
          entities: [node.id],
          signals: [],
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
          summary: `${node.label} viewed proposal ${views} times`,
          whyNow: `proposal viewed ${views} times and no follow-up drafted`,
          suggestedActions: [
            { id: "business.lead.open", label: "Open lead", risk: "read" },
            { id: "business.followup.draft", label: "Draft follow-up", risk: "prepare" },
            { id: "business.followup.send", label: "Send follow-up", risk: "external" },
          ],
          needsHuman: true,
        },
      ];
    }
    return [];
  });
}

import type { BusinessSnapshot } from "./types";

export function createSampleBusinessSnapshot(now = Date.now()): BusinessSnapshot {
  return {
    leads: [
      {
        id: "lead:frappe:deadbridge-acme",
        name: "ACME Manufacturing",
        company: "ACME",
        status: "warm",
        value: 8500,
        source: "frappe",
        lastActivityAt: now - 45 * 60_000,
        proposalViews: 2,
        followupDrafted: false,
      },
    ],
    deals: [
      {
        id: "deal:frappe:deadbridge-acme-site",
        title: "ACME website rebuild",
        leadId: "lead:frappe:deadbridge-acme",
        stage: "proposal",
        value: 8500,
        updatedAt: now - 2 * 60 * 60_000,
      },
    ],
    appointments: [
      {
        id: "appointment:frappe:acme-review",
        title: "ACME proposal review",
        leadId: "lead:frappe:deadbridge-acme",
        at: now + 24 * 60 * 60_000,
      },
    ],
  };
}

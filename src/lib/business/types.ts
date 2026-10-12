export interface BusinessLead {
  id: string;
  name: string;
  company?: string;
  status: "new" | "active" | "warm" | "stalled" | "won" | "lost";
  value?: number;
  source: "frappe" | "manual";
  lastActivityAt: number;
  proposalViews?: number;
  followupDrafted?: boolean;
}

export interface BusinessDeal {
  id: string;
  title: string;
  leadId: string;
  stage: "qualified" | "proposal" | "negotiation" | "won" | "lost";
  value?: number;
  updatedAt: number;
}

export interface BusinessAppointment {
  id: string;
  title: string;
  leadId?: string;
  at: number;
}

export interface BusinessSnapshot {
  leads: BusinessLead[];
  deals: BusinessDeal[];
  appointments: BusinessAppointment[];
}

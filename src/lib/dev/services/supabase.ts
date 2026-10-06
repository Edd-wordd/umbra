import { defineService, notConnected } from "./types";

export interface SupabasePayload {
  project: string;
  region: string;
  dbMb: number;
  dbLimitMb: number;
  tables: { name: string; rows: number; today: number }[];
  authUsers: number;
  functions: { name: string; errors24h: number }[];
}

export const supabase = defineService<SupabasePayload>({
  id: "supabase",
  label: "supabase",
  chip: "supa",
  blurb: "db size, hot tables, auth, edge functions",
  read(p) {
    if (!p) return notConnected("Supabase");
    const fnErrors = p.functions.reduce((n, f) => n + f.errors24h, 0);
    const full = p.dbMb / p.dbLimitMb >= 0.8;
    return {
      status: fnErrors ? "broken" : full ? "attention" : "ok",
      summary: fnErrors ? `${fnErrors} function errors · 24h` : "healthy",
      rows: [
        { k: "database", v: `${p.dbMb} / ${p.dbLimitMb} MB · ${p.region}`, tone: full ? "attention" : undefined },
        ...p.tables.map((t) => ({ k: t.name, v: `${t.rows.toLocaleString("en-US")} rows · +${t.today} today` })),
        { k: "auth", v: `${p.authUsers} users` },
        ...p.functions.map((f) => ({ k: "function", v: `${f.name} · ${f.errors24h} errors 24h`, tone: f.errors24h ? ("broken" as const) : undefined })),
      ],
      actions: [{ label: "open studio ↗", toolId: "dev.link.open", args: { label: `supabase ${p.project}` } }],
    };
  },
});

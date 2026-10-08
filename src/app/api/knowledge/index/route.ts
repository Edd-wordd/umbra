import { getKnowledgeIndexStatus } from "@/lib/knowledge/server-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getKnowledgeIndexStatus();
  return Response.json(status, { status: status.error && status.configured ? 500 : 200 });
}

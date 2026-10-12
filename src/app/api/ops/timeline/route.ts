import { getOpsTimeline } from "@/lib/ops/timeline-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ generatedAt: Date.now(), timeline: await getOpsTimeline(30) });
}

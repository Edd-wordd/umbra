import { getDevSummary } from "@/lib/dev/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ generatedAt: Date.now(), ...getDevSummary() });
}

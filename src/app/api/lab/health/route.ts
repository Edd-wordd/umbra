import { getLabHealth } from "@/lib/lab/health-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getLabHealth());
}

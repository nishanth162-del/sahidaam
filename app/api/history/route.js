import { getHistory } from "@/lib/db.js";

export const dynamic = "force-dynamic";

/** GET /api/history?productId=xxx -> [{ date, bestPrice }] for the chart. */
export async function GET(request) {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) return Response.json({ error: "Missing productId" }, { status: 400 });
  return Response.json({ history: getHistory(productId) });
}

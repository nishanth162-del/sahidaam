import { addWatch, getWatches } from "@/lib/db.js";

export const dynamic = "force-dynamic";

/** GET /api/watch -> current watchlist. POST { productId, targetPrice } -> add. */
export async function GET() {
  return Response.json({ watches: getWatches() });
}

export async function POST(request) {
  try {
    const { productId, targetPrice } = await request.json();
    if (!productId || !targetPrice) {
      return Response.json({ error: "Missing productId/targetPrice" }, { status: 400 });
    }
    addWatch(productId, Math.round(targetPrice));
    return Response.json({ ok: true, watches: getWatches() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

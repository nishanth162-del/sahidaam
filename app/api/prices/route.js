import { shoppingSearch } from "@/lib/serpapi.js";
import { computeVerdict, buyTiming } from "@/lib/verdict.js";
import { upsertProduct, saveSnapshot, getHistory } from "@/lib/db.js";

export const dynamic = "force-dynamic";

function slug(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

/**
 * POST /api/prices { query }
 * Live seller prices -> verdict -> snapshot saved -> JSON.
 */
export async function POST(request) {
  try {
    const { query } = await request.json();
    if (!query || !query.trim()) {
      return Response.json({ error: "Missing query" }, { status: 400 });
    }

    const { offers, cached } = await shoppingSearch(query.trim());
    const productId = slug(query);
    const product = upsertProduct({ id: productId, name: query.trim() });
    const history = getHistory(productId);
    const verdict = computeVerdict(offers, history, query.trim());

    if (verdict.streetPrice) {
      saveSnapshot(productId, {
        bestPrice: verdict.best.price,
        streetPrice: verdict.streetPrice,
        sellerCount: verdict.cleanCount,
        offers: verdict.offers.slice(0, 10),
      });
    }

    return Response.json({ product, verdict, cached, history: getHistory(productId), timing: buyTiming(getHistory(productId)) });
  } catch (e) {
    const status = e.message.includes("SERPAPI_KEY") ? 503 : 502;
    return Response.json({ error: e.message }, { status });
  }
}

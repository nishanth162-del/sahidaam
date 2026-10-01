import { shoppingSearch } from "@/lib/serpapi.js";
import { computeVerdict, buyTiming } from "@/lib/verdict.js";
import { upsertProduct, saveSnapshot, getHistory } from "@/lib/db.js";
import { demoAnalyze, demoPersist } from "@/lib/demoData.js";

export const dynamic = "force-dynamic";

function slug(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

async function analyzeLive(query) {
  const { offers, cached } = await shoppingSearch(query.trim());
  const productId = slug(query);
  const product = upsertProduct({ id: productId, name: query.trim() });
  const history = getHistory(productId);
  const verdict = computeVerdict(offers, history);
  if (verdict.streetPrice) {
    saveSnapshot(productId, {
      bestPrice: verdict.best.price,
      streetPrice: verdict.streetPrice,
      sellerCount: verdict.cleanCount,
      offers: verdict.offers.slice(0, 10),
    });
  }
  return { product, verdict, timing: buyTiming(getHistory(productId)), cached, history: getHistory(productId) };
}

/**
 * POST /api/compare { a, b } — head-to-head verdicts + winner.
 * GET /api/compare?demo=sony-xm5&demo2=bose-qc45 — seeded, no key needed.
 */
export async function POST(request) {
  try {
    const { a, b } = await request.json();
    if (!a?.trim() || !b?.trim()) {
      return Response.json({ error: "Need two products to compare" }, { status: 400 });
    }
    const [ra, rb] = await Promise.all([analyzeLive(a), analyzeLive(b)]);
    return Response.json({ ...pickWinner(ra, rb), cached: ra.cached || rb.cached });
  } catch (e) {
    const status = e.message.includes("SERPAPI_KEY") ? 503 : 502;
    return Response.json({ error: e.message }, { status });
  }
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const a = demoAnalyze(q.get("demo") || "sony-xm5");
  const b = demoAnalyze(q.get("demo2") || "bose-qc45");
  if (!a || !b) return Response.json({ error: "Unknown demo product" }, { status: 400 });
  const pa = demoPersist(q.get("demo") || "sony-xm5");
  const pb = demoPersist(q.get("demo2") || "bose-qc45");
  return Response.json({ ...pickWinner(
    { ...a, product: pa.product, history: pa.history },
    { ...b, product: pb.product, history: pb.history },
  ), demo: true });
}

function pickWinner(ra, rb) {
  const score = (r) =>
    (r.verdict.verdict === "BUY NOW" ? 1000 : 0) + r.verdict.dealScore + (r.verdict.discountVsHistory ?? -50);
  const winner = score(ra) >= score(rb) ? "a" : "b";
  return { a: ra, b: rb, winner };
}

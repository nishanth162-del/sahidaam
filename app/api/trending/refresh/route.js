import { runTrendScan } from "../route.js";

export const dynamic = "force-dynamic";

/**
 * POST /api/trending/refresh — force a fresh live scan.
 * Deliberate and credit-honest: up to ~12 SerpApi searches (Shopping +
 * Trends per product), 0 when the 6h/24h caches are warm. The board itself
 * always loads at 0 credits from the last scan.
 */
export async function POST() {
  try {
    if (!process.env.SERPAPI_KEY) {
      return Response.json({ error: "SERPAPI_KEY is not set" }, { status: 503 });
    }
    const items = await runTrendScan();
    return Response.json({ items, scannedAt: new Date().toISOString(), cached: false });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}

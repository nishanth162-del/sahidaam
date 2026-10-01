import { shoppingSearch, trendsInterest } from "@/lib/serpapi.js";
import { computeVerdict } from "@/lib/verdict.js";
import { upsertProduct, saveSnapshot, getHistory } from "@/lib/db.js";
import { demoTrending, DEMO_IDS } from "@/lib/demoData.js";

export const dynamic = "force-dynamic";

// Curated high-interest products for the live scan (1 credit each, cached 6h).
const SCAN_LIST = [
  "Sony WH-1000XM5",
  "Apple AirPods Pro 2",
  "Samsung Galaxy S24",
  "boAt Airdopes 141",
  "Noise ColorFit Pro smartwatch",
  "Kindle Paperwhite",
];

/**
 * GET /api/trending — today's biggest genuine drops.
 * Live: curated scan via Shopping (+Trends demand signal per product).
 * No key: seeded demo board.
 */
export async function GET() {
  try {
    if (!process.env.SERPAPI_KEY) {
      return Response.json({ items: demoTrending(), demo: true });
    }
    const items = [];
    for (const name of SCAN_LIST) {
      try {
        const { offers } = await shoppingSearch(name);
        const pid = "trend-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
        upsertProduct({ id: pid, name });
        const history = getHistory(pid);
        const verdict = computeVerdict(offers, history);
        if (verdict.streetPrice) {
          saveSnapshot(pid, {
            bestPrice: verdict.best.price,
            streetPrice: verdict.streetPrice,
            sellerCount: verdict.cleanCount,
            offers: verdict.offers.slice(0, 10),
          });
        }
        let demand = null;
        try { demand = (await trendsInterest(name)).trend; } catch { /* optional */ }
        if ((verdict.discountVsHistory ?? 0) >= 5 || verdict.verdict === "BUY NOW") {
          items.push({ id: pid, name, verdict, demand, demo: false });
        }
      } catch { /* one bad product shouldn't kill the board */ }
    }
    items.sort((x, y) => (y.verdict.discountVsHistory ?? -99) - (x.verdict.discountVsHistory ?? -99));
    return Response.json({ items });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}

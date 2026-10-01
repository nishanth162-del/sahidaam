import { shoppingSearch, trendsInterest } from "@/lib/serpapi.js";
import { computeVerdict } from "@/lib/verdict.js";
import { upsertProduct, saveSnapshot, getHistory, getLatestSnapshots } from "@/lib/db.js";
import { demoTrending, DEMO_IDS } from "@/lib/demoData.js";

export const dynamic = "force-dynamic";

// Curated high-interest products for the live scan.
export const SCAN_LIST = [
  "Sony WH-1000XM5",
  "Apple AirPods Pro 2",
  "Samsung Galaxy S24",
  "boAt Airdopes 141",
  "Noise ColorFit Pro smartwatch",
  "Kindle Paperwhite",
];

export function scanProductId(name) {
  return "trend-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
}

/**
 * Run the live scan: one Shopping search (+Trends demand) per product.
 * Each call is cached (6h shopping / 24h trends), so a repeat scan inside
 * the cache window costs 0 credits. Deliberately NOT auto-run on every
 * board view — the board serves the last scan at 0 credits instead.
 */
export async function runTrendScan() {
  const items = [];
  for (const name of SCAN_LIST) {
    try {
      const { offers } = await shoppingSearch(name);
      const pid = scanProductId(name);
      upsertProduct({ id: pid, name });
      const history = getHistory(pid);
      const verdict = computeVerdict(offers, history, name);
      if (verdict.streetPrice) {
        saveSnapshot(pid, {
          bestPrice: verdict.best.price,
          streetPrice: verdict.streetPrice,
          sellerCount: verdict.cleanCount,
          offers: verdict.offers.slice(0, 10),
          verdict,
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
  return items;
}

/** Board from the last scan — 0 SerpApi credits. */
function boardFromSnapshots() {
  const pids = SCAN_LIST.map(scanProductId);
  const snaps = getLatestSnapshots(pids);
  const byId = Object.fromEntries(snaps.map((s) => [s.productId, s]));
  const items = [];
  for (const name of SCAN_LIST) {
    const pid = scanProductId(name);
    const s = byId[pid];
    if (!s || !s.verdict?.streetPrice) continue;
    const v = s.verdict;
    if ((v.discountVsHistory ?? 0) >= 5 || v.verdict === "BUY NOW") {
      items.push({ id: pid, name, verdict: v, demand: null, demo: false, scannedAt: s.takenAt });
    }
  }
  items.sort((x, y) => (y.verdict.discountVsHistory ?? -99) - (x.verdict.discountVsHistory ?? -99));
  const scannedAt = snaps.length ? snaps.map((s) => s.takenAt).sort().pop() : null;
  return { items, scannedAt };
}

/**
 * GET /api/trending — today's biggest genuine drops.
 * Serves the last scan from SQLite at 0 credits; runs a fresh scan only
 * when no snapshot exists yet (first run). No key: seeded demo board.
 */
export async function GET() {
  try {
    if (!process.env.SERPAPI_KEY) {
      return Response.json({ items: demoTrending(), demo: true });
    }
    const pids = SCAN_LIST.map(scanProductId);
    const snaps = getLatestSnapshots(pids);
    if (snaps.length === pids.length) {
      const board = boardFromSnapshots();
      return Response.json({ ...board, cached: true });
    }
    const items = await runTrendScan();
    return Response.json({ items, scannedAt: new Date().toISOString(), cached: false });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}

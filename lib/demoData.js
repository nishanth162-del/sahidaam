/**
 * Seeded demo data for the wow features — no API key needed.
 * Each entry: plausible offers + a history generator the verdict engine consumes.
 */
import { computeVerdict, buyTiming } from "./verdict.js";
import { upsertProduct, saveSnapshot, getHistory, seedDemo } from "./db.js";

function historyAround(base, days, drift = 0, jitterSeed = 1) {
  const out = [];
  const now = Date.now();
  for (let d = days; d >= 1; d--) {
    const jitter = Math.round(Math.sin(d * 1.7 + jitterSeed) * base * 0.012);
    out.push({
      date: new Date(now - d * 864e5).toISOString(),
      bestPrice: Math.round(base + drift * ((days - d) / days) + jitter),
    });
  }
  return out;
}

const CATALOG = {
  "sony-xm5": {
    name: "Sony WH-1000XM5 Wireless Headphones",
    offers: [
      { seller: "Flipkart", price: 21990, rating: 4.3, url: "https://www.flipkart.com" },
      { seller: "Amazon.in", price: 22990, rating: 4.4, url: "https://www.amazon.in" },
      { seller: "Vijay Sales", price: 23490, rating: 4.0, url: "https://www.vijaysales.com" },
      { seller: "Croma", price: 24990, rating: 4.1, url: "https://www.croma.com" },
    ],
    history: () => historyAround(30000, 14, -8000, 1), // was ~30k, now ~22k -> BUY NOW
  },
  "bose-qc45": {
    name: "Bose QuietComfort 45 Headphones",
    offers: [
      { seller: "Amazon.in", price: 24990, rating: 4.5, url: "https://www.amazon.in" },
      { seller: "Croma", price: 26990, rating: 4.1, url: "https://www.croma.com" },
      { seller: "Flipkart", price: 27990, rating: 4.2, url: "https://www.flipkart.com" },
    ],
    history: () => historyAround(28900, 14, -3500, 2),
  },
  "airpods-pro2": {
    name: "Apple AirPods Pro (2nd Gen)",
    offers: [
      { seller: "Amazon.in", price: 16990, rating: 4.6, url: "https://www.amazon.in" },
      { seller: "Flipkart", price: 17490, rating: 4.4, url: "https://www.flipkart.com" },
      { seller: "Croma", price: 18990, rating: 4.1, url: "https://www.croma.com" },
    ],
    history: () => historyAround(19900, 14, -2800, 3),
  },
  "galaxy-s24": {
    name: "Samsung Galaxy S24 5G (8GB, 128GB)",
    offers: [
      { seller: "Flipkart", price: 52999, rating: 4.3, url: "https://www.flipkart.com" },
      { seller: "Amazon.in", price: 54999, rating: 4.4, url: "https://www.amazon.in" },
      { seller: "Samsung Store", price: 62999, rating: 4.5, url: "https://www.samsung.com" },
    ],
    history: () => historyAround(72000, 14, -19000, 4), // steep drop -> board-topper
  },
  "echo-dot": {
    name: "Echo Dot (5th Gen)",
    offers: [
      { seller: "Amazon.in", price: 4449, rating: 4.4, url: "https://www.amazon.in" },
      { seller: "Croma", price: 4990, rating: 4.0, url: "https://www.croma.com" },
    ],
    history: () => historyAround(5400, 14, -900, 5),
  },
  "kindle-ppw": {
    name: "Kindle Paperwhite (16 GB)",
    offers: [
      { seller: "Amazon.in", price: 14999, rating: 4.5, url: "https://www.amazon.in" },
      { seller: "Croma", price: 16999, rating: 4.0, url: "https://www.croma.com" },
    ],
    history: () => historyAround(16999, 14, -500, 6), // barely moved -> FAIR/WAIT
  },
};

function analyze(id) {
  const item = CATALOG[id];
  if (!item) return null;
  const verdict = computeVerdict(item.offers, item.history());
  return {
    id,
    name: item.name,
    verdict,
    timing: buyTiming(item.history()),
    demo: true,
  };
}

/** Full demo analysis for one catalog product (verdict + timing). */
export function demoAnalyze(id) {
  seedDemo();
  return analyze(id);
}

/** Trending board: all catalog products ranked by real discount, biggest first. */
export function demoTrending() {
  seedDemo();
  return Object.keys(CATALOG)
    .map(analyze)
    .filter(Boolean)
    .sort((a, b) => (b.verdict.discountVsHistory ?? -99) - (a.verdict.discountVsHistory ?? -99));
}

/** Persist a demo product + snapshot so history/watchlist keep working. */
export function demoPersist(id) {
  const item = CATALOG[id];
  if (!item) return null;
  const product = upsertProduct({ id: `demo-${id}`, name: item.name });
  const verdict = computeVerdict(item.offers, item.history());
  if (verdict.streetPrice) {
    saveSnapshot(`demo-${id}`, {
      bestPrice: verdict.best.price,
      streetPrice: verdict.streetPrice,
      sellerCount: verdict.cleanCount,
      offers: verdict.offers.slice(0, 10),
    });
  }
  return { product, history: getHistory(`demo-${id}`) };
}

export const DEMO_IDS = Object.keys(CATALOG);

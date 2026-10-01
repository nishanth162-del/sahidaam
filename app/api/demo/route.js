import { computeVerdict, buyTiming } from "@/lib/verdict.js";
import { seedDemo, getHistory, upsertProduct, saveSnapshot } from "@/lib/db.js";

export const dynamic = "force-dynamic";

const DEMO_OFFERS = [
  { seller: "Flipkart", price: 21990, rating: 4.3, url: "https://www.flipkart.com", title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones" },
  { seller: "Amazon.in", price: 22990, rating: 4.4, url: "https://www.amazon.in", title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones" },
  { seller: "Vijay Sales", price: 23490, rating: 4.0, url: "https://www.vijaysales.com", title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones" },
  { seller: "Croma", price: 24990, rating: 4.1, url: "https://www.croma.com", title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones" },
  { seller: "RandomDeals", price: 1499, rating: 2.2, url: "", title: "XM5 hard case cover" },
];

/**
 * GET /api/demo — full verdict flow on seeded data, no API key needed.
 * Powers the "Try a live demo" button and local UI development.
 */
export async function GET() {
  seedDemo();
  const productId = "demo-sony-xm5";
  const product = upsertProduct({ id: productId, name: "Sony WH-1000XM5 Wireless Headphones" });
  const history = getHistory(productId);
  const verdict = computeVerdict(DEMO_OFFERS, history);
  if (verdict.streetPrice) {
    saveSnapshot(productId, {
      bestPrice: verdict.best.price,
      streetPrice: verdict.streetPrice,
      sellerCount: verdict.cleanCount,
      offers: verdict.offers.slice(0, 10),
    });
  }
  return Response.json({ product, verdict, cached: false, demo: true, history, timing: buyTiming(history) });
}

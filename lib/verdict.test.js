import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOffers, rejectOutliers, computeVerdict, buyTiming, looksLikeAccessory } from "./verdict.js";

const OFFERS = [
  { seller: "Amazon.in", price: 22990, rating: 4.4, url: "https://amazon.in/x" },
  { seller: "Flipkart", price: 21990, rating: 4.3, url: "https://flipkart.com/x" },
  { seller: "Croma", price: 24990, rating: 4.1, url: "https://croma.com/x" },
  { seller: "Vijay Sales", price: 23490, rating: 4.0, url: "https://vijaysales.com/x" },
];

const HISTORY = Array.from({ length: 10 }, (_, i) => ({
  date: new Date(Date.now() - (10 - i) * 864e5).toISOString(),
  bestPrice: 26500 - i * 100, // hovering ~26k, then a drop
}));

test("clear discount below 30-day median -> BUY NOW", () => {
  const v = computeVerdict(OFFERS, HISTORY);
  assert.equal(v.verdict, "BUY NOW");
  assert.equal(v.best.seller, "Flipkart");
  assert.equal(v.best.price, 21990);
  assert.ok(v.dealScore >= 60, `score ${v.dealScore}`);
});

test("junk accessory listings get rejected, verdict uses clean set", () => {
  const withJunk = [
    ...OFFERS,
    { seller: "RandomSeller", price: 499, rating: 2.1, title: "headphone case cover" },
    { seller: "BundleKing", price: 89990, rating: 3.0, title: "headphones + speaker bundle" },
  ];
  const v = computeVerdict(withJunk, HISTORY);
  assert.equal(v.rejectedCount, 2);
  assert.equal(v.cleanCount, 4);
  assert.equal(v.verdict, "BUY NOW");
});

test("price above history -> WAIT", () => {
  const pricey = OFFERS.map((o) => ({ ...o, price: o.price + 8000 }));
  const v = computeVerdict(pricey, HISTORY);
  assert.equal(v.verdict, "WAIT");
});

test("single legit seller -> AVOID", () => {
  const v = computeVerdict([{ seller: "OnlyShop", price: 21990, rating: 4.5 }], HISTORY);
  assert.equal(v.verdict, "AVOID");
});

test("no valid offers -> AVOID with zero score", () => {
  const v = computeVerdict([{ seller: "X", price: -5 }, { seller: "Y" }], HISTORY);
  assert.equal(v.verdict, "AVOID");
  assert.equal(v.dealScore, 0);
});

test("no history -> verdict from cross-seller spread, signals say so", () => {
  const v = computeVerdict(OFFERS, []);
  assert.ok(["BUY NOW", "FAIR", "WAIT"].includes(v.verdict));
  assert.ok(v.signals.some((s) => s.includes("No price history")));
  assert.equal(v.discountVsHistory, null);
});

test("normalizeOffers drops bad rows and sorts", () => {
  const n = normalizeOffers([
    { seller: "B", price: 300 },
    { seller: "A", price: 100 },
    { seller: "bad", price: 0 },
    null,
  ]);
  assert.deepEqual(n.map((o) => o.seller), ["A", "B"]);
});

test("rejectOutliers keeps the sane middle", () => {
  const { clean, rejected } = rejectOutliers(
    normalizeOffers([...OFFERS, { seller: "Junk", price: 499 }])
  );
  assert.equal(clean.length, 4);
  assert.equal(rejected.length, 1);
});

function histFrom(prices) {
  return prices.map((p, i) => ({
    date: new Date(Date.now() - (prices.length - i) * 864e5).toISOString(),
    bestPrice: p,
  }));
}

test("buyTiming: falling history -> wait guidance", () => {
  const t = buyTiming(histFrom([30000, 29500, 29000, 28500, 28000, 27500, 27000, 26500]));
  assert.equal(t.trend, "falling");
  assert.ok(t.guidance.includes("trending down"));
});

test("buyTiming: rising history -> buy-sooner guidance", () => {
  const t = buyTiming(histFrom([26000, 26500, 27000, 27500, 28000, 28500, 29000, 29500]));
  assert.equal(t.trend, "rising");
  assert.ok(t.guidance.includes("trending up"));
});

test("buyTiming: flat history -> steady", () => {
  const t = buyTiming(histFrom([26000, 26100, 25900, 26050, 25950, 26000, 26100, 26000]));
  assert.equal(t.trend, "steady");
});

test("buyTiming: too little history -> null", () => {
  assert.equal(buyTiming(histFrom([26000, 26100, 25900])), null);
  assert.equal(buyTiming([]), null);
});

// --- Accessory relevance filter ---

test("looksLikeAccessory: skin in title, not in query", () => {
  assert.equal(looksLikeAccessory("Sony WH-1000XM5 Glitz Series Skins", "Sony WH-1000XM5"), true);
  assert.equal(looksLikeAccessory("Sony WH-1000XM5", "Sony WH-1000XM5"), false);
});

test("looksLikeAccessory: query naming the accessory keeps it", () => {
  assert.equal(looksLikeAccessory("iPhone 16 Clear Case", "iPhone 16 case"), false);
  assert.equal(looksLikeAccessory("boAt Airdopes Charging Cable", "boAt Airdopes 141"), true);
});

test("skins can't win best deal against the real product", () => {
  const offers = [
    { seller: "Slickwraps", price: 2309, title: "Sony WH-1000XM5 Glitz Series Skins" },
    { seller: "Slickwraps", price: 2400, title: "Sony WH-1000XM5 Wood Series Skins" },
    { seller: "Amazon.in", price: 26990, rating: 4.4, title: "Sony WH-1000XM5 Wireless Headphones" },
    { seller: "Flipkart", price: 27490, rating: 4.3, title: "Sony WH-1000XM5 Noise Cancelling Headphones" },
    { seller: "Croma", price: 27990, rating: 4.1, title: "Sony WH-1000XM5 Bluetooth Headset" },
  ];
  const v = computeVerdict(offers, [], "Sony WH-1000XM5");
  assert.equal(v.best.seller, "Amazon.in");
  assert.equal(v.best.price, 26990);
  assert.equal(v.cleanCount, 3);
  assert.equal(v.rejectedCount, 2);
  assert.ok(v.signals.some((s) => s.includes("accessory")), `signals: ${v.signals.join(" | ")}`);
});

test("relevance filter never nukes the result set (fallback)", () => {
  const offers = [
    { seller: "A", price: 499, title: "iPhone 16 Clear Case" },
    { seller: "B", price: 599, title: "iPhone 16 Silicone Cover" },
  ];
  const v = computeVerdict(offers, [], "iPhone 16 case");
  assert.equal(v.cleanCount, 2);
  assert.equal(v.best.price, 499);
});

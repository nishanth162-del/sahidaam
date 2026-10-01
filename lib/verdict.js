/**
 * SahiDaam verdict engine — pure logic, no I/O.
 *
 * Pipeline: normalize -> reject outliers -> street price -> score -> verdict.
 * All math is deterministic and explainable (judges can read this file).
 */

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Drop junk offers: accessories / fake listings priced far below the pack,
 * and bundles / wrong-product listings priced far above it.
 * Keeps offers within [0.35x, 2.5x] of the raw median, then recomputes.
 */
function rejectOutliers(offers) {
  const prices = offers.map((o) => o.price);
  const rawMedian = median(prices);
  if (rawMedian == null) return { clean: [], rejected: offers, rawMedian: null };

  const clean = [];
  const rejected = [];
  for (const o of offers) {
    if (o.price >= rawMedian * 0.35 && o.price <= rawMedian * 2.5) clean.push(o);
    else rejected.push(o);
  }
  return { clean, rejected, rawMedian };
}

/** Normalize: drop invalid prices, sort ascending. */
function normalizeOffers(offers) {
  return offers
    .filter((o) => o && typeof o.price === "number" && isFinite(o.price) && o.price > 0)
    .map((o) => ({
      seller: o.seller || "Unknown seller",
      price: Math.round(o.price),
      url: o.url || "",
      rating: typeof o.rating === "number" ? o.rating : null,
      title: o.title || "",
    }))
    .sort((a, b) => a.price - b.price);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/**
 * @param {Array} rawOffers  [{ seller, price, url, rating?, title? }] in INR
 * @param {Array} history    [{ date: ISO string, bestPrice }] oldest -> newest
 * @returns verdict object
 */
function computeVerdict(rawOffers, history = []) {
  const normalized = normalizeOffers(rawOffers);
  const { clean, rejected } = rejectOutliers(normalized);
  const prices = clean.map((o) => o.price);

  if (clean.length === 0) {
    return {
      verdict: "AVOID",
      dealScore: 0,
      best: null,
      streetPrice: null,
      fairRange: null,
      signals: ["No valid offers found after filtering."],
      cleanCount: 0,
      rejectedCount: rejected.length,
    };
  }

  const streetPrice = Math.round(median(prices));
  const best = clean[0];
  const sorted = [...prices].sort((a, b) => a - b);
  const fairRange = [
    Math.round(sorted[Math.floor(sorted.length * 0.25)]),
    Math.round(sorted[Math.floor(sorted.length * 0.75)]),
  ];

  // History signal: median of best-prices over the trailing 30 days.
  const now = Date.now();
  const recent = history.filter((h) => now - new Date(h.date).getTime() <= 30 * 864e5);
  const histMedian = recent.length ? median(recent.map((h) => h.bestPrice)) : null;

  const discountVsStreet = streetPrice ? (streetPrice - best.price) / streetPrice : 0;
  const discountVsHistory = histMedian ? (histMedian - best.price) / histMedian : null;

  // Seller trust: share of offers from rated sellers (>=4.0), scaled.
  const rated = clean.filter((o) => o.rating != null && o.rating >= 4.0).length;
  const trust = clean.length ? rated / clean.length : 0;

  // Deal score 0-100. History carries the most weight when available.
  // Normalized so the BUY threshold (15% below history) scores ~65+.
  const histPart = discountVsHistory == null ? 0.5 : clamp01(discountVsHistory / 0.2);
  const streetPart = clamp01(discountVsStreet / 0.2);
  const score =
    Math.round(100 * (0.5 * histPart + 0.3 * streetPart + 0.2 * (0.4 + 0.6 * trust))) || 0;

  const signals = [];
  signals.push(
    `Best ₹${best.price.toLocaleString("en-IN")} at ${best.seller} vs street median ₹${streetPrice.toLocaleString("en-IN")}.`
  );
  if (histMedian) {
    const pct = Math.round(((histMedian - best.price) / histMedian) * 100);
    signals.push(
      pct >= 0
        ? `${pct}% below the 30-day median of ₹${Math.round(histMedian).toLocaleString("en-IN")}.`
        : `${Math.abs(pct)}% above the 30-day median of ₹${Math.round(histMedian).toLocaleString("en-IN")}.`
    );
  } else {
    signals.push("No price history yet — verdict based on cross-seller spread only.");
  }
  if (rejected.length) signals.push(`${rejected.length} junk listing(s) filtered out (accessories / mismatches).`);

  let verdict;
  if (clean.length < 2) {
    verdict = "AVOID";
    signals.push("Only one legitimate seller — no competition to validate the price.");
  } else if (trust < 0.34 && best.rating != null && best.rating < 3.5) {
    verdict = "AVOID";
    signals.push("Cheapest sellers look unreliable — risk of fakes or no warranty.");
  } else if ((discountVsHistory != null && discountVsHistory >= 0.15) || score >= 75) {
    verdict = "BUY NOW";
  } else if (discountVsHistory != null && discountVsHistory < -0.05) {
    verdict = "WAIT";
    signals.push("Current best is above the recent typical price — likely to drop.");
  } else {
    verdict = "FAIR";
    signals.push("Decent price, but not a standout deal.");
  }

  return {
    verdict,
    dealScore: score,
    best,
    streetPrice,
    fairRange,
    discountVsHistory: discountVsHistory == null ? null : Math.round(discountVsHistory * 100),
    signals,
    cleanCount: clean.length,
    rejectedCount: rejected.length,
    offers: clean,
  };
}

export { median, normalizeOffers, rejectOutliers, computeVerdict, buyTiming };

/**
 * Best time to buy — from price history only, no crystal balls.
 * Linear trend on recent best-prices + cheapest weekday analysis.
 * Returns null when there's too little history to say anything honest.
 */
function buyTiming(history) {
  if (!history || history.length < 7) return null;

  const n = history.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  history.forEach((h, i) => {
    sx += i; sy += h.bestPrice; sxx += i * i; sxy += i * h.bestPrice;
  });
  const denom = n * sxx - sx * sx;
  const slope = denom ? (n * sxy - sx * sy) / denom : 0; // ₹ per day
  const mean = sy / n;
  const slopePctPerDay = mean ? (slope / mean) * 100 : 0;

  const byDay = {};
  history.forEach((h) => {
    const d = new Date(h.date).getDay();
    (byDay[d] = byDay[d] || []).push(h.bestPrice);
  });
  const dayAvg = Object.entries(byDay).map(([d, arr]) => ({
    day: Number(d),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  }));
  dayAvg.sort((a, b) => a.avg - b.avg);
  const cheapest = dayAvg[0];
  const weekdayEdge = mean ? (mean - cheapest.avg) / mean : 0;
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let trend, guidance;
  const projected14d = Math.round(slope * 14);
  if (slopePctPerDay < -0.4) {
    trend = "falling";
    guidance = `Price is trending down (~${inr(Math.round(Math.abs(slope)))}/day). Waiting 1–2 weeks could save ~${inr(Math.abs(projected14d))} — unless you need it now.`;
  } else if (slopePctPerDay > 0.4) {
    trend = "rising";
    guidance = `Price is trending up (~${inr(Math.round(slope))}/day). Buying sooner likely beats waiting.`;
  } else {
    trend = "steady";
    guidance = "Price has been steady — no strong timing signal. Buy on need, or set a watch below the street median.";
  }

  return {
    trend,
    slopePerDay: Math.round(slope),
    guidance,
    weekday:
      weekdayEdge >= 0.02
        ? `Historically cheapest on ${DAY_NAMES[cheapest.day]}s (~${Math.round(weekdayEdge * 100)}% below average).`
        : null,
  };
}

function inr(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

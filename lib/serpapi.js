/**
 * SerpApi client — Google Shopping / Lens / Trends.
 *
 * Every search burns credits, so responses are cached in SQLite
 * (api_cache table, 6h TTL for shopping, 24h for lens/trends).
 * Without SERPAPI_KEY set, all functions throw a clear error instead
 * of failing mysteriously.
 */
import { db } from "./db.js";

const BASE = "https://serpapi.com/search.json";
const TTL = { shopping: 6 * 3600, lens: 24 * 3600, trends: 24 * 3600 };

function getKey() {
  const k = process.env.SERPAPI_KEY;
  if (!k) throw new Error("SERPAPI_KEY is not set. Add it to .env.local (get one free at serpapi.com).");
  return k;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

function cacheGet(kind, cacheKey) {
  const row = db
    .prepare(`SELECT response_json, created_at FROM api_cache WHERE cache_key = ?`)
    .get(`${kind}:${cacheKey}`);
  if (!row) return null;
  if (Date.now() / 1000 - row.created_at > TTL[kind]) {
    db.prepare(`DELETE FROM api_cache WHERE cache_key = ?`).run(`${kind}:${cacheKey}`);
    return null;
  }
  return JSON.parse(row.response_json);
}

function cacheSet(kind, cacheKey, data) {
  db.prepare(
    `INSERT INTO api_cache (cache_key, response_json, created_at) VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET response_json = excluded.response_json, created_at = excluded.created_at`
  ).run(`${kind}:${cacheKey}`, JSON.stringify(data), Math.floor(Date.now() / 1000));
}

async function serpSearch(params, kind, cacheKey) {
  const cached = cacheGet(kind, cacheKey);
  if (cached) return { ...cached, _cached: true };

  const url = new URL(BASE);
  url.searchParams.set("api_key", getKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SerpApi ${kind} failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`SerpApi ${kind} error: ${data.error}`);

  cacheSet(kind, cacheKey, data);
  return { ...data, _cached: false };
}

/**
 * INR price string -> integer rupees.
 * SerpApi returns strings like "₹21,990" or "₹2,309.38"; both become
 * whole rupees (21990 / 2309). The whole app — seed data, snapshots,
 * verdict math, formatters — works in rupees, so decimals are rounded,
 * never truncated into paise.
 */
export function parsePrice(raw) {
  if (typeof raw === "number") return Math.round(raw);
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const val = parseFloat(cleaned);
  if (!isFinite(val)) return null;
  return Math.round(val);
}

/**
 * Google Shopping: live offers across sellers.
 * Returns normalized [{ seller, price, url, rating, title, thumbnail }].
 */
export async function shoppingSearch(query, { gl = "in", hl = "en" } = {}) {
  const data = await serpSearch(
    { engine: "google_shopping", q: query, gl, hl },
    "shopping",
    `${gl}:${hl}:${query.toLowerCase().trim()}`
  );
  const results = data.shopping_results || [];
  return {
    cached: !!data._cached,
    offers: results
      .map((r) => ({
        seller: r.source || r.seller || "Unknown",
        price: parsePrice(r.price),
        url: r.link || r.product_link || "",
        rating: typeof r.rating === "number" ? r.rating : parseFloat(r.rating) || null,
        title: r.title || "",
        thumbnail: r.thumbnail || "",
      }))
      .filter((o) => o.price != null),
  };
}

/**
 * Google Lens: identify a product from a photo URL.
 * Returns { name, confidence-ish matches }.
 */
export async function lensIdentify(imageUrl) {
  const data = await serpSearch(
    { engine: "google_lens", url: imageUrl },
    "lens",
    imageUrl
  );
  const matches = data.visual_matches || [];
  const best = matches[0];
  return {
    cached: !!data._cached,
    name: best?.title || null,
    link: best?.link || null,
    matches: matches.slice(0, 5).map((m) => ({ title: m.title, link: m.link, thumbnail: m.thumbnail })),
  };
}

/** Google Trends: 12-month interest for a demand signal. */
export async function trendsInterest(query, { geo = "IN" } = {}) {
  const data = await serpSearch(
    { engine: "google_trends", q: query, geo, data_type: "TIMESERIES" },
    "trends",
    `${geo}:${query.toLowerCase().trim()}`
  );
  const series = data.interest_over_time?.timeline_data || [];
  const values = series.map((p) => p.values?.[0]?.value).filter((v) => typeof v === "number");
  if (!values.length) return { cached: !!data._cached, trend: null, points: [] };
  const first = values.slice(0, Math.max(1, Math.floor(values.length / 3)));
  const last = values.slice(-Math.max(1, Math.floor(values.length / 3)));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const change = avg(first) ? (avg(last) - avg(first)) / avg(first) : 0;
  return {
    cached: !!data._cached,
    trend: change > 0.15 ? "rising" : change < -0.15 ? "falling" : "steady",
    changePct: Math.round(change * 100),
    points: values,
  };
}

/**
 * Free-tier credit meter. account.json costs no searches; the result is
 * cached in-memory for 1h so the footer badge never hammers the endpoint.
 * Returns null when SERPAPI_KEY is missing — the badge hides itself.
 */
const ACCOUNT_TTL_MS = 60 * 60 * 1000;
let accountCache = null; // { at, info }

/** Pure: account.json payload -> { left, limit, used, plan }. */
export function summarizeAccount(d) {
  if (!d || typeof d !== "object") return null;
  const limit = Number(d.searches_per_month) || 0;
  const left = Number(d.total_searches_left ?? d.plan_searches_left) || 0;
  return { left, limit, used: Math.max(0, limit - left), plan: d.plan_name || "" };
}

export async function getAccountInfo({ fetcher = fetch, now = Date.now } = {}) {
  if (accountCache && now() - accountCache.at < ACCOUNT_TTL_MS) return accountCache.info;
  if (!process.env.SERPAPI_KEY) return null;
  const url = new URL("https://serpapi.com/account.json");
  url.searchParams.set("api_key", process.env.SERPAPI_KEY);
  const res = await fetcher(url.toString());
  if (!res.ok) return null;
  const info = summarizeAccount(await res.json());
  accountCache = { at: now(), info };
  return info;
}

/** Test-only: clear the in-memory account cache. */
export function _resetAccountCache() {
  accountCache = null;
}

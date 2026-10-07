/**
 * SahiDaam storage — SQLite via better-sqlite3.
 *
 * Tables:
 *   products   — canonical product (identified by normalized name or lens id)
 *   snapshots  — price snapshots over time (powers the history chart)
 *   watchlist  — user price alerts
 *
 * DB file lives at data/sahidaam.db (gitignored). Demo runs locally per
 * hackathon rules, so no hosted DB needed.
 */
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "sahidaam.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL REFERENCES products(id),
    best_price INTEGER NOT NULL,
    street_price INTEGER NOT NULL,
    seller_count INTEGER NOT NULL DEFAULT 0,
    offers_json TEXT NOT NULL DEFAULT '[]',
    taken_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_product ON snapshots(product_id, taken_at);
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL REFERENCES products(id),
    target_price INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// Migration: store the full verdict with each snapshot so the trending
// board can be served at 0 credits (no re-scan needed to render it).
try {
  db.exec(`ALTER TABLE snapshots ADD COLUMN verdict_json TEXT NOT NULL DEFAULT '{}'`);
} catch {
  /* column already exists */
}

function upsertProduct({ id, name, image_url }) {
  db.prepare(
    `INSERT INTO products (id, name, image_url) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, image_url = excluded.image_url`
  ).run(id, name, image_url || null);
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
}

function saveSnapshot(productId, { bestPrice, streetPrice, sellerCount, offers, verdict }) {
  return db
    .prepare(
      `INSERT INTO snapshots (product_id, best_price, street_price, seller_count, offers_json, verdict_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(productId, bestPrice, streetPrice, sellerCount, JSON.stringify(offers || []), JSON.stringify(verdict || {}));
}

/** Latest snapshot per product id: { product_id, best_price, ..., verdict (parsed), taken_at }. */
function getLatestSnapshots(productIds) {
  if (!productIds.length) return [];
  const placeholders = productIds.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT s.* FROM snapshots s
       JOIN (SELECT product_id, MAX(taken_at) AS mx FROM snapshots
             WHERE product_id IN (${placeholders}) GROUP BY product_id) latest
         ON s.product_id = latest.product_id AND s.taken_at = latest.mx`
    )
    .all(...productIds)
    .map((r) => ({
      productId: r.product_id,
      bestPrice: r.best_price,
      streetPrice: r.street_price,
      sellerCount: r.seller_count,
      verdict: (() => { try { return JSON.parse(r.verdict_json || "{}"); } catch { return {}; } })(),
      takenAt: r.taken_at,
    }));
}

/** History for the verdict engine: [{ date, bestPrice }] oldest -> newest. */
function getHistory(productId, days = 30) {
  return db
    .prepare(
      `SELECT taken_at AS date, best_price AS bestPrice FROM snapshots
       WHERE product_id = ? AND taken_at >= datetime('now', ?)
       ORDER BY taken_at ASC`
    )
    .all(productId, `-${days} days`);
}

function addWatch(productId, targetPrice) {
  return db
    .prepare(`INSERT INTO watchlist (product_id, target_price) VALUES (?, ?)`)
    .run(productId, targetPrice);
}

function getWatches() {
  return db
    .prepare(
      `SELECT w.*, p.name AS product_name FROM watchlist w
       JOIN products p ON p.id = w.product_id ORDER BY w.created_at DESC`
    )
    .all();
}

/**
 * Seed a demo product with plausible history so the chart looks alive.
 * Idempotent: tops demo-sony-xm5 up to 14 days of history whenever it's
 * short — fresh DBs, or DBs where real searches landed first. The demo
 * button must work no matter what else is in the database.
 */
function seedDemo() {
  const id = "demo-sony-xm5";
  upsertProduct({
    id,
    name: "Sony WH-1000XM5 Wireless Headphones",
    image_url: "",
  });
  const have = db.prepare(`SELECT COUNT(*) AS c FROM snapshots WHERE product_id = ?`).get(id).c;
  const need = 14 - have;
  if (need <= 0) return false;
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO snapshots (product_id, best_price, street_price, seller_count, taken_at)
     VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'))`
  );
  // Backfill the missing days, oldest first, hovering ~26k. The newest
  // backfilled day drops to ~22k only on a full 14-day seed — on a partial
  // backfill today's own snapshot keeps the story.
  for (let d = need; d >= 1; d--) {
    const jitter = Math.round(Math.sin(d * 1.7) * 400 + (d % 3) * 150);
    const best = need === 14 && d === 1 ? 21990 : 26200 + jitter;
    stmt.run(id, best, best + 1200, 4, Math.floor((now - d * 864e5) / 1000));
  }
  return true;
}

export { db, upsertProduct, saveSnapshot, getHistory, getLatestSnapshots, addWatch, getWatches, seedDemo };

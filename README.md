# SahiDaam — Know the right price

**SerpApi India Hackathon 2026 · Commerce & Market Intelligence track**

Paste a product link (or photo, or name) → get live prices across Indian sellers,
a price-history chart, and a deterministic **BUY NOW / FAIR / WAIT / AVOID** verdict
with a 0–100 deal score. Plus **Vs mode** (head-to-head product battles),
a **Trending drops** board (today's biggest genuine discounts), and
**best-time-to-buy** timing from price history. No tab-hopping, no LLM vibes —
just median math on real data.

## How it works

```
query / link / photo
  → Google Lens (photo → product name)          [SerpApi]
  → Google Shopping (live offers, INR, sellers) [SerpApi]
  → Google Trends (demand signal)               [SerpApi]
  → normalize → reject outlier listings → street median
  → compare vs 30-day snapshot history (SQLite)
  → verdict + deal score + buy-timing + price-drop watchlist

Vs mode:        run the pipeline twice → winner by verdict + score + discount
Trending board: curated high-interest scan → every product through the
                verdict engine → ranked by real discount vs history
```

Every lookup saves a price snapshot, so the history chart gets smarter over time.
SerpApi responses are cached (6h shopping / 24h lens+trends) to stay inside the
free 250-credit/month tier.

## Setup

```bash
git clone <this-repo>
cd sahidaam
npm install
cp .env.example .env.local   # then add your key
npm run dev                  # http://localhost:3000
```

`.env.local`:
```
SERPAPI_KEY=your_key_here   # free at https://serpapi.com (250 searches/month)
```

No key? The app still runs — hit **"Try the live demo"** on the homepage for the
full flow on seeded data, and `/api/prices` returns a clear error otherwise.

> **Install trouble?** If `npm install` fails on `better-sqlite3` (native module),
> run `npm install better-sqlite3` on its own once, then `npm install` again —
> its prebuilt binary download can flake on restricted networks.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/prices` | POST `{ query }` | Live offers → verdict → snapshot saved |
| `/api/identify` | POST `{ imageUrl }` | Google Lens product identification |
| `/api/history?productId=` | GET | Snapshots for the chart |
| `/api/watch` | GET / POST `{ productId, targetPrice }` | Price-drop watchlist |
| `/api/demo` | GET | Full flow on seeded data (no key needed) |
| `/api/compare` | POST `{ a, b }` / GET `?demo=&demo2=` | Vs mode: two verdicts + winner |
| `/api/trending` | GET | Trending drops board, ranked by real discount |

## The verdict engine

`lib/verdict.js` — pure, deterministic, auditable:

1. **Normalize** — drop invalid prices, sort ascending.
2. **Reject outliers** — listings outside [0.35×, 2.5×] of the raw median
   (accessory/fake listings below, bundles/mismatches above) are filtered.
3. **Street price** — median of the clean set.
4. **History check** — current best vs 30-day median of saved snapshots.
5. **Score** — `0.5·history + 0.3·spread + 0.2·seller-trust`, scaled 0–100.
6. **Verdict** — ≥15% below 30-day median (or score ≥75) → BUY NOW;
   above recent typical → WAIT; single/unreliable sellers → AVOID.

Unit tests: `node --test lib/verdict.test.js` (8/8 green).

## Tech

Next.js 16 (App Router) · SQLite (better-sqlite3, local file, gitignored) ·
Tailwind · zero paid services.

## AI disclosure

Built with AI assistance (Muse). All SerpApi integration, verdict math, UI, and
tests were written/reviewed with AI pair-programming; the product decisions,
test strategy, and final code are the author's.

## Roadmap

Swap the SerpApi data layer for a self-hosted Indian e-commerce crawler
(crawl-and-cache, not live-scrape) → Telegram price-check bot with affiliate
links → public comparison site.

import test from "node:test";
import assert from "node:assert/strict";
import { parsePrice } from "./serpapi.js";

// Regression: SerpApi returns decimals ("₹2,309.38"). The whole app works
// in integer rupees (seed data, snapshots, formatters), so decimals must
// round to rupees — never become 100x paise integers.
test("whole-rupee string -> rupees", () => {
  assert.equal(parsePrice("₹21,990"), 21990);
});

test("decimal string rounds to rupees (the 100x bug)", () => {
  assert.equal(parsePrice("₹2,309.38"), 2309);
  assert.equal(parsePrice("₹1,999.00"), 1999);
  assert.equal(parsePrice("₹2,309.50"), 2310);
});

test("numbers pass through rounded", () => {
  assert.equal(parsePrice(21990), 21990);
  assert.equal(parsePrice(2309.6), 2310);
});

test("garbage -> null", () => {
  assert.equal(parsePrice(null), null);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("Free"), null);
  assert.equal(parsePrice("Contact seller"), null);
});

import { summarizeAccount, getAccountInfo, _resetAccountCache } from "./serpapi.js";

test("summarizeAccount reads the free-tier fields", () => {
  const s = summarizeAccount({
    plan_name: "Free Plan",
    searches_per_month: 250,
    total_searches_left: 246,
  });
  assert.deepEqual(s, { left: 246, limit: 250, used: 4, plan: "Free Plan" });
});

test("summarizeAccount falls back to plan_searches_left", () => {
  const s = summarizeAccount({ searches_per_month: 250, plan_searches_left: 100 });
  assert.equal(s.left, 100);
  assert.equal(s.used, 150);
});

test("summarizeAccount rejects garbage", () => {
  assert.equal(summarizeAccount(null), null);
  assert.equal(summarizeAccount("nope"), null);
});

test("getAccountInfo caches for an hour (one fetch, three calls)", async () => {
  const prev = process.env.SERPAPI_KEY;
  process.env.SERPAPI_KEY = "test-key";
  _resetAccountCache();
  try {
    let calls = 0;
    const fake = async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          plan_name: "Free Plan",
          searches_per_month: 250,
          total_searches_left: 200,
        }),
      };
    };
    const t0 = 1_000_000;
    const a = await getAccountInfo({ fetcher: fake, now: () => t0 });
    const b = await getAccountInfo({ fetcher: fake, now: () => t0 + 59 * 60 * 1000 });
    assert.equal(calls, 1);
    assert.equal(a.left, 200);
    assert.equal(b.left, 200);
    await getAccountInfo({ fetcher: fake, now: () => t0 + 61 * 60 * 1000 });
    assert.equal(calls, 2); // TTL expired -> refetch
  } finally {
    _resetAccountCache();
    if (prev === undefined) delete process.env.SERPAPI_KEY;
    else process.env.SERPAPI_KEY = prev;
  }
});

test("getAccountInfo returns null without a key (badge hides)", async () => {
  const prev = process.env.SERPAPI_KEY;
  delete process.env.SERPAPI_KEY;
  _resetAccountCache();
  try {
    assert.equal(await getAccountInfo({ fetcher: async () => { throw new Error("must not fetch"); } }), null);
  } finally {
    if (prev !== undefined) process.env.SERPAPI_KEY = prev;
  }
});

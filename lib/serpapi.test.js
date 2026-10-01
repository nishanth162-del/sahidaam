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

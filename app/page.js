"use client";

import { useState } from "react";
import VerdictCard, { inr, TimingHint } from "../components/VerdictCard";
import PriceChart from "../components/PriceChart";
import SellerTable from "../components/SellerTable";

const LOADING_STEPS = ["Identifying product…", "Checking sellers across India…", "Reading price history…", "Computing verdict…"];
const TABS = [
  ["check", "Check price"],
  ["compare", "Vs mode"],
  ["trending", "Trending drops"],
];

export default function Home() {
  const [tab, setTab] = useState("check");
  const [query, setQuery] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [showPhoto, setShowPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");
  const [watchMsg, setWatchMsg] = useState("");
  // compare tab
  const [qa, setQa] = useState("");
  const [qb, setQb] = useState("");
  const [cmp, setCmp] = useState(null);
  // trending tab
  const [trend, setTrend] = useState(null);

  function reset() { setError(""); setResult(null); setWatchMsg(""); setCmp(null); }

  async function runPrices(q) {
    setLoading(true); reset();
    const tick = setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 1200);
    try {
      const res = await fetch("/api/prices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { clearInterval(tick); setLoading(false); setStep(0); }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (showPhoto && photoUrl.trim()) {
      setLoading(true); reset();
      try {
        const res = await fetch("/api/identify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: photoUrl.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Identification failed");
        if (!data.name) throw new Error("Couldn't identify the product from that photo — try a clearer image or a product name.");
        setLoading(false);
        await runPrices(data.name);
      } catch (e) { setLoading(false); setError(e.message); }
    } else if (query.trim()) {
      await runPrices(query.trim());
    }
  }

  async function loadDemo() {
    setLoading(true); reset();
    try { setResult(await (await fetch("/api/demo")).json()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function runCompare(demo = false) {
    setLoading(true); reset();
    try {
      const res = demo
        ? await fetch("/api/compare?demo=sony-xm5&demo2=bose-qc45")
        : await fetch("/api/compare", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ a: qa, b: qb }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Compare failed");
      setCmp(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadTrending() {
    setLoading(true); reset();
    try { setTrend(await (await fetch("/api/trending")).json()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function refreshTrending() {
    setLoading(true); reset();
    try {
      const res = await fetch("/api/trending/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setTrend(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function addWatch() {
    if (!result || !target) return;
    const res = await fetch("/api/watch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: result.product.id, targetPrice: Number(target) }),
    });
    const data = await res.json();
    setWatchMsg(res.ok ? `Watching — we'll flag it when it drops below ${inr(target)}.` : (data.error || "Couldn't save"));
  }

  const v = result?.verdict;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">SahiDaam <span className="text-indigo-600">सही दाम</span></h1>
            <p className="text-xs text-zinc-500">Know the right price. Live Indian seller data via SerpApi.</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">SerpApi India Hackathon 2026</span>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 px-6">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); reset(); setTrend(null); }}
              className={`rounded-t-xl px-5 py-2.5 text-sm font-semibold ${tab === id ? "bg-zinc-50 text-indigo-700 border-b-2 border-indigo-600" : "text-zinc-500 hover:text-zinc-800"}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {tab === "check" && (
          <form onSubmit={handleSearch} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <label className="text-sm font-semibold">What are you buying?</label>
            <div className="mt-2 flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste a product link, or type a product name — e.g. Sony WH-1000XM5"
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              <button type="submit" disabled={loading}
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                {loading ? "…" : "Check price"}
              </button>
            </div>
            <div className="mt-3 text-sm">
              <button type="button" onClick={() => setShowPhoto(!showPhoto)} className="font-medium text-indigo-600 hover:underline">
                {showPhoto ? "Hide photo search" : "Or identify from a photo →"}
              </button>
              {showPhoto && (
                <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Paste an image URL — we'll identify the product with Google Lens"
                  className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500" />
              )}
            </div>
            <p className="mt-4 text-center text-xs text-zinc-400">
              No key handy? <button type="button" onClick={loadDemo} className="font-semibold text-indigo-600 hover:underline">Try the live demo</button> on seeded data.
            </p>
          </form>
        )}

        {tab === "compare" && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <label className="text-sm font-semibold">Head-to-head: which is the better buy right now?</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <input value={qa} onChange={(e) => setQa(e.target.value)} placeholder="Product A — e.g. Sony WH-1000XM5"
                className="rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-indigo-500" />
              <span className="text-center text-sm font-extrabold text-zinc-400">VS</span>
              <input value={qb} onChange={(e) => setQb(e.target.value)} placeholder="Product B — e.g. Bose QC45"
                className="rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => runCompare(false)} disabled={loading || !qa.trim() || !qb.trim()}
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                {loading ? "…" : "Compare"}
              </button>
              <button onClick={() => runCompare(true)} className="text-xs font-semibold text-indigo-600 hover:underline">
                Try the demo matchup: Sony XM5 vs Bose QC45
              </button>
            </div>
          </div>
        )}

        {tab === "trending" && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold">Today's biggest genuine drops</h2>
            <p className="mt-1 text-sm text-zinc-500">Ranked by real discount vs 30-day history — not inflated MRP claims. The board loads from our last scan at 0 credits; a fresh scan is always your call.</p>
            {trend?.scannedAt && !trend?.demo && (
              <p className="mt-1 text-xs text-zinc-400">Last scan: {new Date(trend.scannedAt).toLocaleString("en-IN")}{trend?.cached ? " · served from cache" : ""}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button onClick={loadTrending} disabled={loading}
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                {loading ? "…" : trend ? "Reload board" : "Show today's drops"}
              </button>
              {!trend?.demo && (
                <button onClick={refreshTrending} disabled={loading} className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50">
                  {loading ? "Scanning…" : "Refresh live scan (~12 credits max)"}
                </button>
              )}
            </div>
            {trend?.demo && <p className="mt-2 text-xs text-amber-700">Demo data — connect a SerpApi key for the live scan.</p>}
          </div>
        )}

        {loading && (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="mt-3 text-sm font-medium text-zinc-600">{tab === "trending" ? "Scanning products…" : LOADING_STEPS[step]}</p>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p className="font-bold">Something didn't work</p>
            <p className="mt-1">{error}</p>
            {error.includes("SERPAPI_KEY") && (
              <p className="mt-2">Add your free key to <code className="rounded bg-rose-100 px-1">.env.local</code> as <code className="rounded bg-rose-100 px-1">SERPAPI_KEY=…</code>, or use the demo buttons.</p>
            )}
          </div>
        )}

        {v && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{result.product.name}</h2>
              <div className="flex gap-2">
                {result.demo && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">DEMO DATA</span>}
                {result.cached && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500">cached · 0 credits</span>}
              </div>
            </div>
            <VerdictCard verdict={v} />
            <TimingHint timing={result.timing} />
            <PriceChart history={result.history} currentBest={v.best?.price} />
            <SellerTable offers={v.offers} bestPrice={v.best?.price} />
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h3 className="font-bold">Price-drop alert</h3>
              <p className="mt-1 text-sm text-zinc-500">Tell us your price, we re-check on every lookup and flag the drop.</p>
              <div className="mt-3 flex gap-2">
                <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Target price, e.g. 19999" inputMode="numeric"
                  className="w-48 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500" />
                <button onClick={addWatch} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-700">Watch</button>
              </div>
              {watchMsg && <p className="mt-2 text-sm font-medium text-emerald-700">{watchMsg}</p>}
            </div>
          </div>
        )}

        {cmp && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">Winner</p>
              <p className="mt-1 text-xl font-extrabold text-indigo-900">
                {(cmp.winner === "a" ? cmp.a : cmp.b).name || (cmp.winner === "a" ? cmp.a.verdict.best?.seller : "")}
              </p>
              <p className="mt-1 text-sm text-indigo-700">
                {(() => { const w = cmp.winner === "a" ? cmp.a : cmp.b; const l = cmp.winner === "a" ? cmp.b : cmp.a;
                  const gap = l.verdict.best && w.verdict.best ? l.verdict.best.price - w.verdict.best.price : 0;
                  return `${w.verdict.verdict} · score ${w.verdict.dealScore}${gap > 0 ? ` · ${inr(gap)} cheaper than the rival's best` : ""}`; })()}
              </p>
              {cmp.demo && <span className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">DEMO DATA</span>}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {[cmp.a, cmp.b].map((r, i) => (
                <div key={i} className={`space-y-4 rounded-2xl p-1 ${cmp.winner === (i === 0 ? "a" : "b") ? "ring-2 ring-indigo-400" : ""}`}>
                  <h3 className="px-1 text-sm font-bold">{r.product?.name || r.name}</h3>
                  <VerdictCard verdict={r.verdict} />
                  <TimingHint timing={r.timing} />
                </div>
              ))}
            </div>
          </div>
        )}

        {trend && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {trend.items.map((it) => (
              <div key={it.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold">{it.name}</h3>
                  {it.verdict.discountVsHistory != null && it.verdict.discountVsHistory > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                      ↓ {it.verdict.discountVsHistory}%
                    </span>
                  )}
                </div>
                <p className="mt-2 text-lg font-extrabold">{inr(it.verdict.best.price)} <span className="text-xs font-medium text-zinc-500">at {it.verdict.best.seller}</span></p>
                <p className="mt-1 text-xs text-zinc-500">Score {it.verdict.dealScore} · {it.verdict.verdict}
                  {it.demand ? ` · demand ${it.demand}` : ""}</p>
              </div>
            ))}
            {!trend.items.length && <p className="text-sm text-zinc-500">No genuine drops found right now — check back later.</p>}
          </div>
        )}

        {!result && !cmp && !trend && !loading && !error && tab === "check" && (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Live seller spread", "Google Shopping data across Amazon.in, Flipkart, Croma & more — one table, no tab-hopping."],
              ["Price history", "Every lookup saves a snapshot. The chart shows whether today is actually a deal."],
              ["Deterministic verdict", "No LLM vibes — median math, outlier filtering, and a 0–100 deal score you can audit."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-bold">{t}</h3>
                <p className="mt-1 text-sm text-zinc-500">{d}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
        SahiDaam · Built for the SerpApi India Hackathon 2026 · Commerce & Market Intelligence track
      </footer>
    </div>
  );
}

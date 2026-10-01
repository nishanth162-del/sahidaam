"use client";

import { inr } from "./VerdictCard";

/** Minimal SVG price-history chart. history: [{ date, bestPrice }]. */
export default function PriceChart({ history, currentBest }) {
  if (!history || history.length < 2) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
        Not enough price history yet — check back after a few snapshots and the trend line appears here.
      </div>
    );
  }

  const W = 640, H = 220, PAD = 36;
  const prices = history.map((h) => h.bestPrice);
  const min = Math.min(...prices, currentBest ?? Infinity) * 0.97;
  const max = Math.max(...prices, currentBest ?? 0) * 1.03;
  const X = (i) => PAD + (i / (history.length - 1)) * (W - 2 * PAD);
  const Y = (p) => H - PAD - ((p - min) / (max - min)) * (H - 2 * PAD);

  const pts = history.map((h, i) => `${X(i).toFixed(1)},${Y(h.bestPrice).toFixed(1)}`).join(" ");
  const firstDate = new Date(history[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const lastDate = new Date(history[history.length - 1].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-bold">Price history</h3>
        <span className="text-xs text-zinc-500">{history.length} snapshots · {firstDate} → {lastDate}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} className="stroke-zinc-100" strokeWidth="1" />
        ))}
        <polyline points={pts} fill="none" className="stroke-indigo-600" strokeWidth="2.5" strokeLinejoin="round" />
        {history.map((h, i) => (
          <circle key={i} cx={X(i)} cy={Y(h.bestPrice)} r="3.5" className="fill-indigo-600" />
        ))}
        {currentBest != null && (
          <g>
            <circle cx={X(history.length - 1)} cy={Y(currentBest)} r="6" className="fill-emerald-500" />
            <text x={X(history.length - 1)} y={Y(currentBest) - 12} textAnchor="middle" className="fill-emerald-700 text-xs font-bold">
              {inr(currentBest)} today
            </text>
          </g>
        )}
        <text x={PAD} y={14} className="fill-zinc-400 text-xs">{inr(Math.round(max))}</text>
        <text x={PAD} y={H - 8} className="fill-zinc-400 text-xs">{inr(Math.round(min))}</text>
      </svg>
    </div>
  );
}

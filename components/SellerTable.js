"use client";

import { inr } from "./VerdictCard";

export default function SellerTable({ offers, bestPrice }) {
  if (!offers || !offers.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <h3 className="border-b border-zinc-100 px-6 py-4 font-bold">
        {offers.length} sellers compared
      </h3>
      <ul className="divide-y divide-zinc-100">
        {offers.map((o, i) => (
          <li key={i} className="flex items-center gap-4 px-6 py-3.5">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"}`}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{o.seller}</p>
              {o.rating != null && <p className="text-xs text-zinc-500">★ {o.rating.toFixed(1)}</p>}
            </div>
            <span className={`text-base font-extrabold ${o.price === bestPrice ? "text-emerald-700" : ""}`}>
              {inr(o.price)}
            </span>
            {o.url ? (
              <a href={o.url} target="_blank" rel="noopener noreferrer"
                 className="shrink-0 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700">
                Buy
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

const STYLES = {
  "BUY NOW": { bg: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Buy now — this is a genuine deal" },
  FAIR: { bg: "bg-sky-500", soft: "bg-sky-50 text-sky-800 border-sky-200", label: "Fair price — not a standout deal" },
  WAIT: { bg: "bg-amber-500", soft: "bg-amber-50 text-amber-800 border-amber-200", label: "Wait — price is above its usual range" },
  AVOID: { bg: "bg-rose-500", soft: "bg-rose-50 text-rose-800 border-rose-200", label: "Avoid — too risky at this price" },
};

export function inr(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

/** Best-time-to-buy hint: trend guidance + cheapest-weekday note. */
export function TimingHint({ timing }) {
  if (!timing) return null;
  const color =
    timing.trend === "falling" ? "border-amber-200 bg-amber-50 text-amber-900"
    : timing.trend === "rising" ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-zinc-200 bg-zinc-50 text-zinc-700";
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <h3 className="text-sm font-bold">⏳ Best time to buy <span className="ml-1 rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-semibold uppercase">{timing.trend}</span></h3>
      <p className="mt-1.5 text-sm">{timing.guidance}</p>
      {timing.weekday && <p className="mt-1 text-sm opacity-80">{timing.weekday}</p>}
      <p className="mt-2 text-[11px] opacity-60">Estimate from price history — not financial advice.</p>
    </div>
  );
}

export default function VerdictCard({ verdict }) {
  const s = STYLES[verdict.verdict] || STYLES.FAIR;
  const pct = Math.max(0, Math.min(100, verdict.dealScore));
  const circ = 2 * Math.PI * 44;

  return (
    <div className={`rounded-2xl border p-6 ${s.soft}`}>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="10" className="stroke-current opacity-15" />
            <circle
              cx="50" cy="50" r="44" fill="none" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ - (circ * pct) / 100}
              className={verdict.verdict === "BUY NOW" ? "stroke-emerald-600" : verdict.verdict === "AVOID" ? "stroke-rose-600" : verdict.verdict === "WAIT" ? "stroke-amber-600" : "stroke-sky-600"}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold">{verdict.dealScore}</span>
            <span className="text-[10px] uppercase tracking-wide opacity-70">deal score</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className={`inline-block h-3 w-3 rounded-full ${s.bg}`} />
            <h2 className="text-2xl font-extrabold tracking-tight">{verdict.verdict}</h2>
          </div>
          <p className="mt-1 text-sm opacity-80">{s.label}</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>Best: <b>{inr(verdict.best.price)}</b> · {verdict.best.seller}</span>
            <span>Street median: <b>{inr(verdict.streetPrice)}</b></span>
            {verdict.discountVsHistory != null && (
              <span>{verdict.discountVsHistory >= 0 ? "↓" : "↑"} {Math.abs(verdict.discountVsHistory)}% vs 30-day median</span>
            )}
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 border-t border-current/10 pt-4 text-sm">
        {verdict.signals.map((sig, i) => (
          <li key={i} className="flex gap-2"><span className="opacity-50">→</span><span>{sig}</span></li>
        ))}
      </ul>
    </div>
  );
}

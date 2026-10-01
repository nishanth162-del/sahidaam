# SahiDaam demo video script — under 3 minutes

Record at localhost:3000 (or the Render URL), 1080p, mic on. Judging is on
functionality, not production quality — one clean take with the features
visible is enough. Lead with what makes SahiDaam different, not the generic
price tracker (that's literally the track's example idea).

## 0:00–0:25 — Hook: photo in, verdict out (the magic moment)
Homepage hero on screen.
> "Indians overpay for gadgets every day — not because deals don't exist, but
> because the real price is scattered across ten tabs. SahiDaam fixes that.
> Watch: no link, no typing — just a photo."

Click "Or identify from a photo →", paste an image URL of the Sony WH-1000XM5,
submit. Lens identifies it; the pipeline runs.
> "Google Lens identifies the product via SerpApi, then the same verdict
> engine takes over. Photo to price verdict in seconds."

## 0:25–0:55 — Vs mode (the wow shot, early)
Switch to the "Vs mode" tab, click the demo matchup.
> "And this settles the group-chat debate with data: Sony XM5 versus
> Bose QC45 — two live verdicts, deal scores, one winner."

Point at the winner banner and the two verdict cards.

## 0:55–1:35 — Check price: live data → verdict
Back to "Check price", type "Sony WH-1000XM5", hit Check price. Narrate the
loading steps.
> "Under the hood it pulls live Google Shopping data via SerpApi — Amazon,
> Flipkart, Croma — then runs deterministic verdict math. Median math, outlier
> filtering, a 0–100 deal score. No AI guessing; you can audit it in one file."

Show the verdict card, then scroll the seller table.
> "Best price versus street median, every seller in one table — and notice the
> signal line: accessory listings get set aside automatically, so a ₹2,300 skin
> can never pose as the headphone price."

Scroll to the "Best time to buy" hint.
> "The timing engine reads the price trend and tells you whether waiting a
> week actually saves money."

## 1:35–1:55 — Price history (proof, not MRP theater)
Show the chart.
> "Every lookup saves a snapshot, so the chart proves today is genuinely a
> deal — not a strikethrough-MRP trick."

## 1:55–2:25 — Trending drops + the credit story
Switch to "Trending drops", click "Show today's drops" — it loads instantly.
> "Every morning SahiDaam hunts the biggest genuine drops itself — ranked by
> real discount against 30-day history. And here's the part I'm proud of:
> this board costs zero SerpApi credits to view. It serves the last scan from
> our own database."

Click "Refresh live scan (~12 credits max)".
> "A fresh scan is always your call, with the cost printed on the button. We
> treat API credits like money — 6-hour cache on shopping, 24-hour on Lens
> and Trends, and a 'cached · 0 credits' badge wherever a lookup cost nothing."

Point at the cached badge on a re-run price check if visible.

Scroll to the footer.
> "And this little pill down here — live credit meter. It shows exactly how
> many of our 250 free monthly searches are left, fetched for zero searches.
> We built the whole app to sip the free tier, and we prove it on screen."

## 2:25–3:00 — Close
Back to homepage.
> "SahiDaam — सही दाम, know the right price. Commerce & Market Intelligence
> track. Next.js, SQLite, three SerpApi engines — Shopping, Lens, Trends —
> and verdict math you can read in one file. Repo link below."

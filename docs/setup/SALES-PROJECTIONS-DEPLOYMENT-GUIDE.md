# Sales Projections — Deployment & Execution Guide

**Status: Step 1 of 12. Nothing is built.**

The design lives in [`docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md`](../sales/SALES-PROJECTIONS-ARCHITECTURE.md) — _what_ we're building and why. **This document is the ordered execution log** — what has actually been run, what comes next, and which steps are gates that can cancel the whole feature.

Everything in `supabase/` is hand-run in the Supabase SQL editor; editing a `.sql` file in this repo does **not** change production.

**Three steps are STOP gates** (2, 4, 7). Each can legitimately end this project. They exist so a model never reaches a dashboard on enthusiasm alone, and a "stop" outcome at any of them is a successful result, not a failure.

---

## Progress log

| Date       | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Architecture designed. Superseded `hyrax-data-platform/docs/plans/10-forecasting-predictive-analytics-plan.md`, which had been written without repo access against an unbuilt star schema.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-01 | Phase 0 diagnostic SQL written: `supabase/diagnostics/sales_projection_phase0_evidence.sql`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-01 | **Phase 0 run — results INVALID.** See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-02 | Pipeline completeness repaired (`hyrax-data-platform/docs/plans/11-watermark-completeness-audit.md`). Prerequisite now met.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-02 | **Step 0 passed** — `reconcile.py` clean. **Step 1 re-run** on reconciled data; §11 of the architecture doc filled in. **Step 2 gate: PROCEED WITH CAUTION** (avg top-3 concentration 31.2% over 24 complete months).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-02 | **Step 3 views written** — series, decomposition, baseline, backtest. Not yet pasted into Supabase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-02 | **Phase A built and backtested.** Chain-ladder: unbiased from h=3 (+14% at h=1, correctable), 38% single-month error, owns 59.3% of next month. **Passes as an ensemble member.** Two defects found and fixed en route — survivorship bias in the development factors, and a lateral-join timeout. See architecture doc §11e.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-02 | **Phase B built and backtested.** Scoring harness extended to h = 1/3/6/12; `freqsev` and `ma12` forward twins added. Gate passed — `freqsev` scores MASE 0.748 at twelve months.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-03 | **Phase C, first pass — three wiring bugs found and fixed.** (1) SES method filter used a doubled backslash and matched nothing; (2) SES emitted only four horizons via `distinct on`; (3) ensemble weights existed only at scored horizons, so eight of twelve months silently vanished.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-03 | **Two more bugs, found by reading C5 and C7 together.** (1) `v_sales_projection_calibration` unioned two CTEs with `select *` — `UNION ALL` matches by POSITION, and the expansion CTE listed `origins_recent` and `bias_all` in the opposite order, so the chain-ladder took an origin COUNT into `bias_all` and its factor became 1 + 24 = 25. The order book was divided down to RM292,159 against a RM4.45M prediction and the h=1 blend read 46% BELOW trailing actuals. (2) The ensemble joined calibration on FORWARD model names (`baseline`, `ses`) against the calibration view's SCORING names (`ma12`, `ses_020`); only `freqsev` matched, so two of three models were never calibrated. Both fixed; explicit column lists and a name-mapping CTE. |
| 2026-10-03 | **C8–C11: the order-book model diagnosed.** Chain-ladder bias flips sign inside the 24-month calibration window (+37.6% over the last 6 origins, +4.9% over 12, +10.8% over 23 — correct for neither regime). C10 cleared the obvious suspect: 89% of its forecast comes from orders ≤6 months old, so it is not reading stale value. C11 found the cause — comparing the same six months year on year, **orders are up 43% while invoicing is down 35%**. The book is filling with real orders that are not converting.                                                                                                                                                                                                                                       |
| 2026-10-03 | **🛑 PHASE C GATE RUN — the ensemble FAILED at h=1 and the BF weighting was overturned.** The blend ranked 4th of 6 (MAE 1.78M vs 1.50M for `ses_020` alone). C16 found the cause: in 20 of 22 months at least 4 of 5 members missed in the SAME direction — every model is a trailing-level model, so averaging cancels nothing. C15 then found the real discovery: the chain-ladder is **worst at h=1 and best at h=6**. Forecasting August 2026 it was +98.6% wrong from one month out and +4.2% wrong from six months out. Bornhuetter-Ferguson weights it by `coverage(h)` — 63% at h=1, 13% at h=6 — which is **upside down for this business**.                                                                                                         |
| 2026-10-03 | **Also found by the gate:** the calibration-window hypothesis was WRONG — a 6-month window was worst at every horizon, not best (noise beats staleness). And two blocks could not answer their question at all: h=12 was unscoreable, and the multi-month test could not build a 3-month span, both because the scoring view only covered four horizons.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-03 | **Two structural changes made in response.** (1) `sales_projection_baseline_view.sql` now scores **every horizon 1..12** — this also retires the "borrow the nearest scored horizon" approximation in three downstream views and the h=1 error fallback in `v_sales_model_baseline`. (2) `sales_projection_ensemble_backtest_view.sql` now **sweeps the order-book weight** (0.0–1.0, with `coverage(h)` retained in the grid as the BF candidate) instead of assuming it.                                                                                                                                                                                                                                                                                     |
| 2026-10-03 | **🛑 PHASE C GATE PASSED on the second run.** C20: the two-parameter smooth weight rule `w(h) = min(0.8, 0.2 + 0.12·(h−1))` costs 0–3.6% against per-horizon fitting and beats `coverage(h)` by 13–106%. The ensemble now **beats or ties the best single model at 9 of 11 scoreable horizons** (only h=1 at +1.4% and h=8 at +3.6% behind). Calibration window set to **12 months** — lowest total MAE across h=1..8. The regime hypothesis that opened Phase C was **wrong**: a 6-month window was worst almost everywhere; noise costs more than staleness.                                                                                                                                                                                                 |
| 2026-10-03 | **C21: h=12 cannot be validated, and never will be from this data.** At a twelve-month horizon the most prior scored origins available at any point is 5, against a guard of 6 — and relaxing the guard would buy exactly one origin. The chain-ladder backtest starts 2024-04 (the development view needs 36 months of cohorts first), so h=12 burns a year and then needs its priors a year older still. **Published horizon capped at 6 months.** Fortunately the fiscal year (Apr–Mar) ends 2027-03, which from Oct 2026 is h=1..5 — the full-year outlook sits entirely inside the validated range. C19 puts the 6-month total error at ~10–11% against 32–42% for any single month.                                                                      |
| 2026-10-03 | **Live views updated to match the gate.** `sales_projection_ensemble_view.sql` now weights the order book by the measured rule rather than `coverage(h)` — in the blend and in both variance terms — and publishes `order_book_weight`. `coverage(h)` is retained where it is still correct: scaling the chain-ladder to a full-month figure. `sales_projection_calibration_view.sql` window 24 → 12.                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-03 | **Cascade banner corrected.** `drop view … cascade` on the baseline view drops **six** views, not the two previously documented. The omission caused `42P01: relation "public.v_sales_model_ses" does not exist`. Full dependency map now at the top of `sales_projection_baseline_view.sql`, regenerable with `grep -l v_sales_projection_baseline supabase/sql_editor/*.sql`.                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-03 | **C4 re-confirmed α = 0.20**, now fitted over 288 origins (12 horizons x 24) rather than 96. The ensemble backtest's hardcoded `ses_020` member stands. **C3 on the 12-month window** shows larger a-priori biases than the 24-month one (freqsev +31.1% vs +23.4%, ses_020 +18.4% vs +11.6%) — expected, since the shorter window sits entirely inside the decline. Larger factors mean lower calibrated predictions.                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-03 | **C5/C6/C7 timed out, and the cause was the horizon extension.** Three correlated laterals existed solely to borrow "the nearest scored horizon" when only four were scored. With all twelve scored they matched exactly and did nothing but cost — over an input three times larger. The ensemble also read `v_sales_model_ses` twice (once via a `cal_name` lookup purely to recover alpha) and scanned the scoring view twice for `ma12`/`freqsev`. All removed: **every view now reads the scoring view exactly once and no correlated laterals remain.**                                                                                                                                                                                                  |
| 2026-10-03 | **All 14 projection views converted from `drop … cascade` to `create or replace`.** The cascade was never needed for the horizon change — the column list did not move, only the rows. `drop` is now reserved for an actual column-list change, which Postgres reports as 42P16 rather than leaving it to guesswork; appending a column at the end needs no drop. Dependency map and the rule live in the banner of `sales_projection_baseline_view.sql`.                                                                                                                                                                                                                                                                                                      |
| 2026-10-03 | **Chain-ladder variance switched from theoretical to measured.** It was the only model still using a Bernoulli-per-order formula — a model of how it _should_ err, not how it does. At h=6 that implied an SD of ~RM5.9M against a measured MAE of RM0.95M, roughly 6x too wide, then divided by `coverage²` on top. Now takes MSE from `v_sales_chainladder_backtest`, consistent with SES (`mae²`) and baseline (`rmse²`). Bernoulli retained as a fallback for unscoreable horizons. Effect: h=12 SD −55%, h=12 `lo_80` +225%. The near-zero lower bounds are gone.                                                                                                                                                                                         |
| 2026-10-03 | **C5 reconciles exactly** at all twelve horizons; `order_book_weight` confirms the smooth rule (0.200 → 0.800, capped). **h=1 projects RM4.14M, +31% over trailing-3m** — down from +71%, and consistent with the RM3.97M average order intake of the last three months. First forward number in this project to survive an independent sanity check.                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-03 | **🔴 PHASE D BLOCKER FOUND.** One query to `v_sales_projection_ensemble` recomputes `v_sales_projection_baseline` **four times** (via SES, via backtest→model_baseline, via calibration, and directly) and `v_sales_chainladder_backtest` **twice** (via calibration, and via the chain-ladder model since the variance change). Six full backtest rebuilds to produce twelve rows. C22b timed out on it. The dashboard RPC will call this view on every page load, so **materialising both backtests is a prerequisite for Phase D** — both are backtests over closed history and cannot change until a month closes. `sales_projection_backtest_cache.sql` already does this for the ensemble backtest; it needs extending to the other two.                 |
| 2026-10-03 | **C22/C23: intervals were 46–134% too wide**, and had never been scored — every point estimate had, the bands never. Cause was structural: `within + between` sums each member's variance, but the blend errs _less_ than its members, and the chain-ladder's variance is divided by `coverage(h)²` which explodes as coverage collapses. Band now sized from the ensemble's own measured error, monotone in horizon. h=1 sd RM2.77M → **RM1.90M**; band RM1.58M–7.50M → **RM2.15M–6.59M**, with the published lower ratio (0.52) now matching the empirical 10th percentile (0.52) exactly.                                                                                                                                                                   |
| 2026-10-03 | **Three backtest caches created** in `private` + `refresh_sales_projection_caches()`. One forward-ensemble query had been rebuilding the scoring harness 4× and the chain-ladder backtest 2×. All 14 projection views converted to `create or replace`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-03 | **🛑 PHASE C CLOSED.** §11g written. Final config: order-book weight `w(h) = least(0.8, 0.2+0.12·(h−1))`, calibration window 12 months, SES α=0.20, interval from measured error, **published horizon 1–6**. November 2026 projects **RM4,140,562** (80%: RM2.15M–6.59M) against RM3.16M trailing and RM3.97M recent order intake.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-03 | **Phase D built.** `model_detail` appended to `v_sales_projection_ensemble` (per-model implied values, so the RPC reads one object rather than four). New `get_sales_projections_rpc.sql` — **no parameters**, Finance-style guard (`SAL`/`MGM` manager or superadmin, `42501`) because the sources reach `private.mv_*` which cannot carry RLS. Fiscal-year arithmetic reuses the existing `fy_window` CTE idiom rather than re-deriving it. Cache staleness is derived from the data (cached scored month vs latest closed month) instead of a timestamp table.                                                                                                                                                                                              |
| 2026-10-03 | **Frontend built.** `FanChartRenderer.jsx` — the codebase's first `ComposedChart` and first `Area`; ranged bands are two-element arrays. `FanChartTooltip.jsx` is **separate from the shared `CustomTooltip` on purpose**: that component passes values through `preciseNumber`, which returns non-numbers unchanged, so a `[lo, hi]` array reaches React and renders as two concatenated digit-strings with no separator and no `RM` — it fails silently, and eight existing charts depend on it. Four tiles via `projectionConfig.js` (three informational blue, one verdict), three charts, wired into `Reports.jsx` with its own query key and a 30-minute `staleTime`, deliberately outside the page's shared loading/error chain.                        |
| 2026-10-03 | **Scope corrections recorded against architecture §9**, struck through rather than rewritten: the "Next 12 Months" tile is replaced by the fiscal-year outlook (h=12 unvalidatable, C21); a third informational tile was added for the order-book gap (the finding did not exist when §9 was written); the accuracy tile and actual-vs-expected chart are deferred to Phase E, both blocked on frozen snapshots.                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-14 | **🔴 Two faults found in how the model was TESTED, both mine.** (1) `first_origin = current_date - interval '30 months'` in the chain-ladder backtest — a bound set for performance and never revisited, so the order-book model was tested on 29 months while 106 existed. (2) The conversion rates came from a window ending _today_, so scoring March 2025 applied rates partly derived from 2026. Because the blend contains that model, **every parameter in the system was chosen on 22 observations, and the accuracy figure came from those same 22.** Also retracted: the claim that h=12 "cannot be validated — not a choice". It was a choice.                                                                                                      |
| 2026-10-14 | **Stage 1 built.** New `sales_order_development_pit_view.sql` computes link ratios for every as-of month; `sales_order_development_view.sql` becomes a thin filter over it at the current month, so one calculation serves both the forward model and the backtest. Backtest window now **derived** (earliest order + 36 months ≈ 2020-11) rather than a literal. Hold-out flag added to the ensemble backtest — last 12 origins. Window 6 dropped from the sweep, already measured worst everywhere.                                                                                                                                                                                                                                                          |
| 2026-10-14 | **Stages 1–2 verified.** C25: conversion rates now move by as-of month (0.502 in Nov 2020, down to 0.249 in Feb 2024, back to 0.351 today) — the point-in-time fix binds. C21: origins 29 → **70**, and h=12 gained 41 scoreable origins, retracting the claim that twelve months "cannot be validated". C26a: band coverage **77–82% at every horizon**, the first properly calibrated interval in this project.                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-14 | **🔴 A regression found and fixed in the same pass.** With the widened backtest, C7 published RM8.4M at six months and **RM27.9M at twelve** against a RM4.5M norm. Cause (C3/C5): at h=12 there were zero origins inside the 12-month calibration window, so the view fell back to a five-year-old bias of −77.3%, floored the factor at 0.25 and multiplied by four — then `coverage(12)` = 0.030 multiplied by 33 again. 133× in total. Two fixes: the order-book weight **reverted to `coverage(h)`** (self-limiting — a model seeing 3% of a month can no longer drive 80% of the forecast), and the stale-bias fallback removed (no recent evidence now means **no correction**, and `basis` reads `uncalibrated`).                                      |
| 2026-10-14 | **The Phase C headline was overturned, then partly restored.** Phase C claimed Bornhuetter-Ferguson was "upside down for this business", on 22 contaminated observations. On 52 clean ones `coverage(h)` ranks 1st at h=3, 1st at h=6, 2nd at h=1 and h=12 (C24a) — the textbook was right. But C24d then showed the C24a-chosen settings performing **worse** on the hold-out than the shipped ones, because selection (2021–2025) and hold-out (Oct 2025–Aug 2026) are different regimes. **Neither reading is wrong; the parameter is not stable.** That is the standing argument for walk-forward.                                                                                                                                                         |
| 2026-10-14 | **C27, the gate re-run against what is actually live.** The blend wins at h=1 and h=3 on all 63 origins. `ses_020` wins h=1 on the hold-out by 41% but runs **+22.5% high** there against the blend's **+3.8%**. `seasonal_naive` wins h=6 and h=12 on full history — beyond three months our modelling adds little over "last year repeated", recorded here rather than hidden. **Decision: keep the blend at every horizon.** A noisier centred number beats a tighter biased one, and one model everywhere means no special case.                                                                                                                                                                                                                           |
| 2026-10-14 | **Phase E built.** `sales_projection_snapshots` + RLS, `snapshot_sales_projections()`, the first monthly cron in this repo, `v_sales_projection_accuracy` (recorded vs reconstructed, never merged), `get_sales_projection_accuracy()`, and a **Track Record** section on Sales Reports with its own fiscal-year selector.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-14 | **Phase E deployed.** Table, writer, cron, accuracy view and RPC all live. First snapshot taken by hand. |
| 2026-10-14 | **The two projection sections merged into one.** They drew the same thing twice — for every month they shared, "Actual vs Projected" and "Forecast vs Actual" plotted the same actual line against the same one-month-ahead forecast from the same backtest. One chart now runs a whole fiscal year: what we said, what happened, and what we now expect for the months still ahead. The detail table is **removed** — the chart already carries its data. All 7 tiles kept for now; which to cut is a later call. |
| 2026-10-14 | **🔴 A third stale-filter bug found, in the live KPI.** `get_sales_projections_rpc.sql` filtered `cl_weight_label = 'smooth w(h)'` in **two** places. The 2026-10-14 revert to `coverage(h)` swept the views and missed this file. One instance feeds the old chart's historical line; the other (`span_origins`, line 230) sizes **`fullYearLo80`/`fullYearHi80`** — so the Full-Year range on the live dashboard has been a band measured against one blend wrapped around a point estimate produced by another. Fixed. The chart's copy is left stale for exactly one release, deliberately, so the old and new charts can be diffed as proof the fix landed. |
| 2026-10-14 | **Future fiscal years are now selectable.** Standing in October 2026, FY2027-28 shows Apr–Oct 2027 projected (horizons 6–12) and Nov 2027–Mar 2028 **blank** — the models emit 12 months from today and stop. The blanks are the point: a year we can only half-see shows how far we can see, then stops. |
| 2026-10-14 | **The six-month cap is not applied to the merged chart.** It existed because C21 found h=12 unvalidatable — a claim §11h retracts (5 scoreable origins → 46, coverage 77–82% at every horizon). Applying it would make any future fiscal year almost entirely blank. Months past six are counted into `monthsBeyondValidated` and disclosed in the subtitle. |
| 2026-10-15 | **The published blend is cached.** `v_sales_projection_ensemble` measured **4,202 ms to produce twelve rows**, on every page load, twice over — the entire cost of the Projections section. Now `private.mv_sales_projection_ensemble`, the fifth cache. |
| 2026-10-15 | **🔴 The daily refresh is a CORRECTNESS requirement, not a speed one.** The ensemble stores no dates — `period_month` is derived from `current_date` inside three model views. A cache built last month names the month we are now IN as horizon 1, and `get_sales_projections` filters `period_month > cur_month` against a **live** calendar — so that row is not rejected, it is **silently dropped**. `n_months` falls by one, the Full-Year outlook **and its 80% band** both move, nothing raises. Hence 00:20 MYT: a nine-hour wrong-month window on the 1st becomes twenty minutes. |
| 2026-10-15 | **Three estate firsts, each argued in section 6's banner:** a UNIQUE index on a materialized view, `refresh ... concurrently`, and a `cache_refreshed_at` column. The last breaks this estate's "detect staleness from the data, not a timestamp" preference on purpose — that works for the backtest caches because `max(period_month)` of scored history *is* a watermark; twelve forward rows have none, so a cron that died three weeks ago would be invisible. |
| 2026-10-15 | **Architecture §8b written** — the first complete map of how every object in this module updates. Three kinds of object, four clocks. Read it if "what does the RPC refresh?" is ever a question again. (Answer: nothing. It reads.) |
| 2026-10-16 | **The two projection RPCs merged into one, and the section became month-selectable.** `get_sales_projection_accuracy` is absorbed into `get_sales_projections(p_fiscal_year_start)`; all four tiles and all three charts now follow the one fiscal-year dropdown. Tile 3 ("Order Book vs Statistical") is replaced by the **live current month** against the forecast frozen for it. Clicking a month on the main chart re-points tile 2 and both exhibit charts. `fanChartData` and its stale `smooth w(h)` filter deleted. **One SQL file to run — see the run order below. It contains a `drop function`, and the order is not optional.** |
|            | **← you are here. Next: run the merged RPC (run order below), deploy the frontend, then drop the absorbed function.** |

---

## The RPC merge (2026-10-16) — deploy order

**Three statements, three separate moments.** The middle one is a frontend
deploy, and the order matters because the running bundle keeps calling the old
function until it is replaced.

### 1. Run `supabase/sql_editor/get_sales_projections_rpc.sql` — THE WHOLE FILE, ONE SUBMISSION

The file opens with a `drop function if exists public.get_sales_projections();`
and this is **not** optional cosmetics:

> `create or replace` cannot alter a function's argument list. Adding
> `p_fiscal_year_start` creates a **second overload** rather than replacing the
> first, and PostgREST refuses a name with two overloads — `PGRST203`. The
> section does not degrade, it goes blank.

Running the drop and the create as one submission keeps the window to the
second or two between them, during which the page 500s. Do not run them as two
separate submissions, and do not run the drop alone "to check".

Confirm exactly one overload survived:

```sql
select p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_sales_projections';
```

**One row**, reading `get_sales_projections(integer)`. Two rows means the drop
did not take and the page is already broken.

### 2. Deploy the frontend

The old bundle calls `get_sales_projection_accuracy`. It still exists at this
point, so the page keeps working through step 1 — that is the entire reason
step 3 is separate.

### 3. Only then, drop the absorbed function

```sql
drop function if exists public.get_sales_projection_accuracy(int);
```

Its SQL file is already deleted from the repo; this statement is the last
thing that references it.

### Then verify

Run the ten checks in the `VERIFY` banner at the foot of
`get_sales_projections_rpc.sql`. The three worth doing by hand before trusting
the section:

1. **The year reconciles.** `actualToDate + currentMonthEstimate +
   projectedRemainder = outlook` on the current FY. On a closed FY, `outlook =
   actualToDate` and the other two are 0.
2. **Every month's exhibit adds up.** For each key in `exhibitsByMonth`,
   `From Order Book + From Statistical Models = Projected Total`, exactly. A
   mismatch on a `rebuilt afterwards` month means the `cl_weight` join picked
   up the wrong grid point — that weight exists only on the ensemble row.
3. **The bars are the same five on every month.** Different names on a rebuilt
   month than on a live one means the `ma12`/`baseline` mapping drifted:

```sql
select distinct jsonb_array_elements(v->'methods')->>'name'
from jsonb_each((get_sales_projections()->>'exhibitsByMonth')::jsonb) as t(k, v);
```

Five rows. No `ma12`, no `ses_020`, no `seasonal_naive`.

**Expect `kpis.month.currentPriorForecast` to be null** until 1 November 2026.
The first snapshot was taken by hand on 2026-10-14 and its one-month-ahead
target is November, so no frozen October forecast exists. It cannot be
backfilled and the tile is built to show an em-dash until it appears.

---

## The ensemble cache — deploy order

**Two deploys, deliberately.** Deploy 1 creates the cache and nothing reads it — zero production impact, and rollback is a `drop`. Deploy 2 repoints the readers, and its rollback is re-running the previous version of three files.

### Deploy 1 — the cache

| # | Run | Note |
| --- | --- | --- |
| 1 | `sql_editor/sales_projection_materialization.sql` — **section 6 only**, plus **section 5** | Section 5 is `create or replace function`, always safe. Sections 0–4 are unchanged and **must not** be re-run — they will fail `2BP01`, which is correct |
| 2 | `select public.refresh_sales_projection_ensemble_cache();` | The first run, by hand. Expect `12 rows, h=1 is <next month>` |
| 3 | `sql_editor/schedule_refresh_sales_projection_ensemble_cron.sql` | The daily job |

🔴 **Section 6 has no `2BP01` protection.** The rest of this file is safe to re-run because a no-cascade drop fails once *views* depend on a cache. Section 6's consumers are three **function bodies**, which register no catalog dependency — so its `drop materialized view if exists` **succeeds silently** and the next page load raises `42P01`. Run section 6 whole or not at all.

**Section 5 calls a function defined in section 6**, further down the same file. Fine on a full-file run (plpgsql resolves calls at call time, not creation). On a partial run, **run both** or it raises `42883`.

### Then verify — before deploying anything else

1. 🔴 **C28a — does the cache equal the view?** In `supabase/diagnostics/sales_projection_phaseC_verification.sql`. Run it **as written, inside its transaction** — the order book commits between statements and comparing across two snapshots shows real churn that looks like cache error. **Zero rows, both directions.**
2. 🔴 **C28b — the frozen-calendar assertion.** Expect **12, 12, 0**. A non-zero `calendar_mismatches` means the cache was built in a previous month and **nothing should be repointed at it** until it is refreshed.
3. **Did `concurrently` work?** Step 2 of the deploy already told you. If it raised, remove the keyword from `refresh_sales_projection_ensemble_cache()` and redeploy — nothing else in section 6 depends on that choice.
4. **Timing.** `explain (analyze) select * from private.mv_sales_projection_ensemble;` — milliseconds, against 4,202 ms for the view.
5. **`select * from cron.job;`** — `refresh-sales-projection-ensemble-daily` is there. This is the **second** scheduled matview refresh in the repo, retiring half of `schedule_snapshot_sales_projections_cron.sql`'s "two firsts" claim.

### Deploy 2 — repoint the readers

| # | Run | Note |
| --- | --- | --- |
| 1 | `sql_editor/get_sales_projections_rpc.sql` | `proj` reads the cache; `sourceView` corrected; four staleness keys added |
| 2 | `sql_editor/get_sales_projection_accuracy_rpc.sql` | `fwd` reads the cache; `sourceView` corrected |
| 3 | `functions/snapshot_sales_projections.sql` | reads the cache, and gains `private` in its `search_path` |

All three are `create or replace function` with unchanged signatures — no drop, no `PGRST203`.

4. **Both RPCs return JSON identical to before**, and both drop well under a second. `select get_sales_projections();` and `select get_sales_projection_accuracy();`
5. **No React change is needed.** `ensembleCacheStale` is OR'd into the existing `cacheStale`, so the banner already on the page fires for either failure.
6. 🔴 **The rollover test — the one that actually matters.** On **1 November**, before 00:20 MYT, confirm `ensembleCacheStale` is true and the banner fires; after the job, confirm it clears.
   ```sql
   select * from cron.job_run_details
   where jobid = (select jobid from cron.job
                  where jobname = 'refresh-sales-projection-ensemble-daily')
   order by start_time desc limit 5;
   ```

**One thing NOT to "fix" later:** `sales_projection_ensemble_view.sql` now has a dependant. A `drop view ... cascade` there silently deletes the cache, and the three RPCs raise `42P01` on the next page load — the 2026-10-03 cascade failure, one level up. A column-list change means: drop view cascade → re-run the view → re-run **section 6** → refresh. That warning is in the view's own header.

---

## The merge — deploy order

Each file on its own, in this order.

| # | Run | Note |
| --- | --- | --- |
| 1 | `sql_editor/sales_projection_accuracy_view.sql` | `create or replace view`. Appends `lo_95`/`hi_95` only — **appending needs no drop**. Nothing else reads this view |
| 2 | `sql_editor/get_sales_projection_accuracy_rpc.sql` | `create or replace function`, same name, same argument list, same return type. **No drop, no `PGRST203`**. 🔴 **Re-run this if you deployed it before the 2026-10-14 double-scan fix — the first version timed out.** |
| 3 | `sql_editor/get_sales_projections_rpc.sql` | `create or replace function`. The `span_origins` weight fix |

**Nothing cascades and nothing is dropped.** Order matters only between 1 and 2 — the RPC reads the widened view.

Then deploy the frontend. `trackRecordTableConfig.jsx` is deleted.

### Run these three BEFORE trusting the chart

1. **The fan-out check.** Must return two equal numbers.
   ```sql
   select count(*), count(distinct period_month)
   from public.v_sales_projection_accuracy where horizon = 1;
   ```
   The RPC LEFT JOINs this onto a 12-month spine. A duplicate fans the join out and the chart gains repeated months with no error raised anywhere.

2. **The horizon identity** the blank-month logic rests on.
   ```sql
   select horizon, period_month from public.v_sales_projection_ensemble order by horizon;
   ```
   Every row must satisfy `period_month = date_trunc('month', current_date) + horizon months`.

3. 🔴 **The query that validates dropping the six-month cap.**
   ```sql
   select horizon, count(*) from private.mv_sales_projection_ensemble_backtest
   where estimator='ensemble' and window_months=12
     and cl_weight_label='coverage(h)' and predicted>0
   group by horizon order by horizon;
   ```
   **Every horizon must show ≥ 20.** That is the guard on the ensemble view's `measured_quantiles`; below it the band falls back to the lognormal and the far end of the fan balloons. If any horizon is short, reinstate a cap at the last horizon that clears 20.

### Then verify

4. `select get_sales_projection_accuracy(2027);` — 12 rows, 7 with a non-null `projected`, 5 null except `name` and `segment = 'blank'`. `monthsScored` is 0 and that is correct.
5. `select get_sales_projection_accuracy(2024);` — **`monthsScored` unchanged** from before. The regression test that the 12-row spine did not leak into the aggregates.
6. **Seam continuity.** For the last closed month and the first forward month, `band80[0]/projected` must agree to 4 decimal places **when the closed month is `reconstructed`** — the two band derivations are bit-identical. They will differ when it is `recorded`, and that is correct: a frozen snapshot keeps the configuration it was frozen under. Do not "fix" it.
7. **The Full-Year band moved.** Compare `fullYearLo80`/`fullYearHi80` before and after step 3 — it should change, because it was sized from the abandoned weight. If it did not move, the fix did not take.
8. **In the browser:** changing the fiscal year must not fire `get_sales_reports_dashboard` (watch the network tab). Pick a future year and confirm blanks render as gaps, not zeros. Pick the oldest year and confirm `NoResult` rather than an empty chart frame. Hover a past month and confirm the tooltip says **Recorded** or **Reconstructed**. Dark mode, phone width.
9. **Rename the accuracy RPC** and confirm the forward tiles and the rest of Sales Reports still render.

### 🔴 If it times out

The first deploy of the merged RPC did. Cause, and the rule it produced:

**`v_sales_projection_ensemble` is NOT a materialized view.** It joins six live
views (chainladder, baseline, freqsev, ses, calibration twice, coverage) and
scans the backtest cache twice for its measured bands, to produce twelve rows.
It is the most expensive object in this feature.

The merged RPC read it **twice** — once in the `fwd` CTE, and again inside the
`years` subquery, which named the view directly instead of the CTE. Postgres
cannot share those: a CTE referenced twice is materialized and evaluated once,
but a separate reference to the underlying view is a second full build. Same
mistake on `v_sales_projection_accuracy`. Four heavy evaluations where two
would do.

**The rule, now written into the file:** inside this RPC, downstream CTEs read
`acc_h1` and `fwd`, never the views. A direct view reference looks free when
the subquery asks for one column; it is not, because the planner still builds
the whole view to produce it.

To confirm the fix landed, time it:

```sql
explain (analyze, buffers) select get_sales_projection_accuracy();
```

Look for how many times `v_sales_projection_ensemble`'s scan appears. **Once.**
If the page is still slow after this, the next lever is materialising the
ensemble itself into `private.mv_sales_projection_ensemble` alongside the other
four caches — twelve rows, trivial to store, and **both** RPCs would stop
rebuilding it on every page load. That is a real design decision, not a tuning
knob: the chain-ladder leg reads the open order book, which changes daily, so a
monthly-refreshed cache would freeze the order-book signal between runs.
`cacheStale` already exists to detect exactly that, but the trade is worth
stating out loud before taking it.

**Still to delete, next release:** `fanChartData` and its CTE chain (`backfit`, `fan_hist`, `fan_hist_band`, `fan_cur`, `fan_cur_band`, `fan_fwd`, `fan`) in `get_sales_projections_rpc.sql`. **Do not also delete `cal`, `nxt`, `cur_mtd` or `cur_est`** — they look like part of that chain and are not; `cur_est` feeds `fullYearCurrentMonthEstimate`, and the Full-Year tile reads a month low without it. The file carries this warning at the `backfit` CTE.

---

## Phase E — deploy order

Each file on its own.

| #   | Run                                                       | Note                                                                                                                                                                 |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `sql_editor/sales_projection_snapshots_migration.sql`     | table + 3 RLS policies. `create table if not exists`, nothing dropped                                                                                                |
| 2   | `functions/snapshot_sales_projections.sql`                | `create or replace function`                                                                                                                                         |
| 3   | `sql_editor/sales_projection_accuracy_view.sql`           | `create or replace view`                                                                                                                                             |
| 4   | `sql_editor/get_sales_projection_accuracy_rpc.sql`        | new function, no `drop` needed — a **companion** to `get_sales_projections()`, not a change to its signature, which would need an explicit drop and risks `PGRST203` |
| 5   | `select public.snapshot_sales_projections();`             | the first snapshot, by hand                                                                                                                                          |
| 6   | `sql_editor/schedule_snapshot_sales_projections_cron.sql` | the monthly job                                                                                                                                                      |

**Nothing cascades.** The only `drop` statements are `drop policy if exists` before each policy is recreated.

### Then verify

1. **12 rows landed** — `select count(*), min(horizon), max(horizon) from sales_projection_snapshots;`
2. **Run step 5 again.** It must return a no-op message and change nothing. If it writes a second set, the idempotency key is wrong and a double-fired cron would quietly rewrite history.
3. **`config->>'weight_rule'` reads `coverage(h)`.** It is derived by comparing the weight actually applied against coverage, so `custom` means the ensemble view has moved and this function's assumptions are stale.
4. **h=1 `projected` equals the Next Month tile exactly.** A difference means the function is reading something other than the live view.
5. **`v_sales_projection_accuracy` has `reconstructed` rows and ZERO `recorded` rows.** Correct, not a bug — no month has closed since the first snapshot. The first recorded row appears in December.
6. **Band coverage agrees with C26a** (~80%). A material difference means the view and the diagnostic disagree about what "inside the band" means.
7. **`select get_sales_projection_accuracy();`** — `availableYears` must not be empty, and `monthlyData` must be `[]` rather than `null` for a year with no data.
8. **Call it as a non-SAL/MGM user** — must raise `42501`.
9. **Calling `snapshot_sales_projections()` as a normal user must raise**, not insert.
10. **⚠ Test RLS from a real manager's session, not the SQL editor.** The editor runs as owner and bypasses RLS entirely, so a broken policy looks perfect there and returns an empty section in the app. That is exactly how the `pipeline_run_log` fault went unnoticed — see `policies/reconciliation_results_access.sql`.
11. **Changing the fiscal year must not refetch the page.** Watch the network tab: `get_sales_reports_dashboard` must not fire.
12. **Break the accuracy RPC** (rename it) — the forward Projections section and the rest of Sales Reports must still render.
13. **`select * from cron.job;`** — the new job is there. It will show alongside two jobs created in the Supabase dashboard that have no file in this repo (`auto_clock_out`'s sweeps); those are not strays.

**The first scheduled run is 2 November.** The first real accuracy measurement is **December** — the October snapshot predicts November, November closes, December compares them.

---

## Stages 1–2 — deploy order

**Every view file is `create or replace`. Nothing cascades, nothing gets dropped.** The only `drop` statements live in the materialization file, and only its section 0 is new — sections 1–3 have dependants and will refuse.

| #   | Run                                                                                     | Replaces in place                                                                                   | What depends on it (survives untouched)          |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | `sales_order_development_pit_view.sql`                                                  | _(new object)_                                                                                      | —                                                |
| 2   | `sales_projection_materialization.sql` — **section 0 + its one grant + section 5 ONLY** | creates and populates `mv_sales_order_development_pit`; `create or replace` on the refresh function | sections 1–3 will fail `2BP01` — do not run them |
| 3   | `sales_order_development_view.sql`                                                      | `v_sales_order_development` → a filter                                                              | `v_sales_model_chainladder`                      |
| 4   | `sales_chainladder_backtest_view.sql`                                                   | `v_sales_chainladder_backtest`                                                                      | `mv_sales_chainladder_backtest`                  |
| 5   | `sales_projection_ensemble_backtest_view.sql`                                           | `v_sales_projection_ensemble_backtest`                                                              | `mv_sales_projection_ensemble_backtest`          |
| 6   | `select public.refresh_sales_projection_caches();`                                      | rebuilds all four caches in dependency order                                                        | —                                                |

**One refresh, at the end.** An earlier draft of this table also refreshed at step 3. That rebuilt the chain-ladder cache against its _old_ definition and then threw the result away at the final step. The caches are the slow part — refresh once, after every definition has moved.

**Between steps 4 and 6** the chain-ladder cache still holds data from the 30-month definition. That is a deploy window, not a fault. The dashboard is unaffected throughout: from step 3 onward `v_sales_order_development` reads the new cache at the current month, which returns what it returned before.

Then, from `diagnostics/sales_projection_phaseC_verification.sql`:

| Block    | Checks                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------- |
| **C25**  | Did the point-in-time fix bind? Rates must **move** between as-of months. A flat column means it did not |
| **C21**  | Origins should be ~70, not 29. `earliest_origin` ≈ 2020-11                                               |
| **C24c** | Is the hold-out actually splitting anything? Both counts non-zero                                        |
| **C24a** | Pick the configuration, blind to the hold-out. Compare against 12 months / 0.2→0.8                       |
| **C24b** | **The number that can be quoted.** Accuracy on origins no parameter has seen                             |

**C24b should come out worse than the ~33% reported so far.** If it is better, the hold-out is not being held out — check C24c before believing it.

**A2/A3 must be unchanged.** `v_sales_order_development` is now a filter; if its output moved, the filter is selecting the wrong month.

---

## Phase D — deploy order

Each file on its own, in the Supabase SQL editor. All views are `create or replace`, so nothing gets dropped.

| #   | File                                            | Note                                                                                           |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | `sql_editor/sales_projection_ensemble_view.sql` | adds `model_detail`, appended at the end of the select list so `create or replace` stays valid |
| 2   | `sql_editor/get_sales_projections_rpc.sql`      | new function, no `drop` needed                                                                 |

**`sales_projection_materialization.sql` is NOT part of this deploy.** An earlier draft of this table said to re-run its section 3, which was wrong. `private.mv_sales_projection_ensemble_backtest` copies `v_sales_projection_ensemble_**backtest**`, and Phase D changed `v_sales_projection_ensemble` — the _forward_ view. The backtest view has zero references to the forward view and was not touched, so the caches are not stale and re-running section 3 would be a slow no-op.

The caches only need refreshing when **a month closes** or **a model changes**, and then it is `select public.refresh_sales_projection_caches();` rather than re-running the file. Step 4 below is what tells you.

Then verify, in this order:

1. `select get_sales_projections();` — every key present, no array key `null`.
2. `kpis.nextMonthProjected` equals verification **C6**'s h=1 figure exactly (**RM4,140,562**).
3. `fullYearActualToDate + fullYearCurrentMonthEstimate + fullYearProjectedRemainder = fullYearOutlook`. The three parts are published separately precisely so this is checkable by eye — a silent off-by-one month in the fiscal window would otherwise be invisible.
4. `kpis.cacheStale` is `false`. If `true`: `select public.refresh_sales_projection_caches();`
5. `kpis.bandBasis` reads `'measured span error'`. `'summed monthly variance'` means the backtest could not reach this span length and the band assumes independent months — which C16 showed they are not.
6. Call it as a non-SAL/MGM user: it must raise `42501`, not return data.

Frontend, on `/app/sales/reports`:

7. The fan shows a solid actual line, a dashed forward line that **attaches** to it, and nested bands starting at the seam.
8. Hover a forward point — the tooltip reads `RM 2,146,830 – RM 6,593,225`, not a concatenated digit string.
9. **Break the RPC deliberately** (rename it) and reload: the rest of Sales Reports must still render.
10. Change the Salesperson filter — the projection must not move, and the subtitle must already say so.
11. Dark mode, and phone width.
12. Tiles 1–3 blue with no badge; tile 4 carries both a ramp colour and a badge. Order: `sales_projection_baseline_view.sql` → `backtest` → `model_baseline` → `model_ses` → `calibration` → `ensemble` → `ensemble_backtest`. Then §11g and Phase D. |

### What Phase 0 changed about the plan

Three findings carry forward into Steps 3 and 4 (full detail in architecture doc §11):

1. **The concentration is real, not an artifact.** It barely moved after the pipeline repair (31.9% → 31.2%), because the five months driving the average were never affected by the defect. Roughly one month in five is genuinely tender-dominated.
2. **Invoiced revenue is down 36.1% year on year**, like-for-like Jan–Sep, on reconciled data — volume down 15%, average deal size down 25%. **Trend handling, not seasonality, is now the central modelling problem.**
3. **So seasonal-naive is a weak comparator.** It repeats last year into a market a third below last year: systematically high, and trivially easy to beat. Step 4 therefore also scores against a **drift-adjusted** seasonal naive, and that is the comparator `is_publishable` believes.

### Why the first Phase 0 was thrown away

It ran against data that was materially incomplete. Three pipeline defects had been silently dropping rows for months; the repair the following day changed the series underneath the analysis:

| 2026                 | Phase 0 measured | Actual  |
| -------------------- | ---------------- | ------- |
| August invoices      | 50               | **82**  |
| September invoices   | 42               | **89**  |
| August GL entries    | 202              | **706** |
| September GL entries | 97               | **487** |

The headline finding — _"invoicing collapsed in August–September"_ — was the bug, not the business. Orders and collections were normal throughout, which is precisely what exposed it.

**The lesson is now Step 0 below:** never analyse data you have not reconciled against its source. Phase 0 existed to stop a model being built on unchecked data, and it did its job — just one layer deeper than intended.

---

## Step 0 — Confirm the data can be trusted

**Run from the edge node, or locally with the Cloudflare tunnel up:**

```bash
cd ingestion/sap_supabase          # in hyrax-data-platform
python -m src.reconcile --tables oinv,inv1,ordr,rdr1,orct,rct2
```

**Pass condition:** every table reads `+0`, and every natural key shows `0` collisions.

Two differences are expected, documented, and not blockers — both are the same upsert-only limitation (the pipeline never deletes): `rdr1` carries a small negative diff from sales-order lines deleted in SAP, and `ocrd` a single one from a deleted customer. Neither affects the invoiced-revenue series.

**If anything else is non-zero, stop here** and repair it before measuring anything. This step costs 20 seconds and is the reason the first attempt was wasted.

> This is now automated — a daily `30 6 * * *` cron runs `reconcile.py --persist --alert` and writes to `reconciliation_results`. Step 0 is a point-in-time confirmation before a decision that depends on it, not a substitute for that.

---

## Step 1 — Phase 0 evidence ⬜ **NEXT**

**Run:** [`supabase/diagnostics/sales_projection_phase0_evidence.sql`](../../supabase/diagnostics/sales_projection_phase0_evidence.sql), blocks **1, 1b, 2, 2b, 3, 4**, each on its own, in the Supabase SQL editor.

Read-only. No DDL, no writes.

| Block  | Answers                                                                 |
| ------ | ----------------------------------------------------------------------- |
| 1      | Depth per measure — first/last month, months present vs. months in span |
| 1b     | The actual series, last 60 months, all three measures side by side      |
| **2**  | **Concentration per month — the kill criterion**                        |
| **2b** | **One-row verdict: STOP / CAUTION / PROCEED**                           |
| 3      | Year-level structure — step changes, incomplete years                   |
| 4      | Seasonality smell test (raw, un-detrended — a smell test only)          |

**Save** each grid to `supabase/diagnostics/results/projection/` as `phase0_1.csv`, `phase0_2.csv` and so on.

**Then fill in §11 of the architecture doc** with the block 1 and 2b rows. That section is currently a warning that its own contents are invalid; replacing it is this step's deliverable.

**What to watch for:**

- **`months_present < months_in_span`** means calendar gaps. This matters more than it looks: `lag(value, 12)` counts _rows_, not months, so one missing month silently shifts the entire seasonal baseline by a position. If gaps exist, every downstream view needs a `generate_series` month spine rather than relying on row order.
- **The series start is 2017-11, not the first row.** 2011–2016 is partial SAP rollout, not business — 2015 totalled RM260k across 10 months against RM42.4M in 2017. Confirm this still holds post-repair.
- **Expect better numbers than the first pass.** Missing rows _inflate_ concentration, so the true top-3 share should be below the 31.9% measured on broken data.

---

## Step 2 — 🛑 GATE: is the series model-shaped?

**Decide from block 2b's verdict, then record the decision in §11.**

| `avg_top3_share_pct` | Meaning           | Action                                              |
| -------------------- | ----------------- | --------------------------------------------------- |
| < 25%                | Broad book        | **Proceed** to Step 3                               |
| 25–40%               | Mixed             | **Proceed**, expect wide intervals                  |
| **> 40%**            | **Tender-driven** | **STOP.** Record the finding; do not build Engine A |

Above 40%, what looks like seasonality is a contract cycle. Every smoothing method in this design is the wrong family, and no amount of modelling fixes it. Also watch `invoice_count` — a month carrying only a handful of documents is structurally unforecastable whatever the share column says.

**There is a cheaper alternative on the table at this gate**, and it should stay choosable: a trailing-3-month run-rate line on the existing Invoiced-vs-Budget chart is roughly one day's work — one CTE, no new page, no new table, no new renderer — and plausibly delivers most of the perceived value. If that satisfies the stakeholder, close this project rather than building it.

---

## Step 3 — Phase 1: build the measurement views

**These do not exist yet and must be written.** Nothing user-facing; no RPC, no page, no table.

| File to write                                                 | Produces                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `supabase/sql_editor/sales_projection_series_view.sql`        | `v_sales_monthly_series` — the three measures, unpivoted         |
| `supabase/sql_editor/sales_projection_decomposition_view.sql` | `v_sales_monthly_trend`, `v_sales_seasonal_index`                |
| `supabase/sql_editor/sales_projection_baseline_view.sql`      | `v_sales_projection_baseline` — seasonal-naive, the comparator   |
| `supabase/sql_editor/sales_projection_backtest_view.sql`      | `v_sales_projection_backtest` — rolling-origin MAE / MASE / bias |

All `security_invoker = on`, per `enable_attendance_views_security_invoker.sql`.

**The series definitions are load-bearing.** `v_sales_monthly_series` must match `base_invoices` / `base_orders` / `base_payment_apps` in `get_sales_reports_dashboard_rpc.sql` character for character. If they drift, the fan chart's history leg will disagree with the "Invoiced Revenue" tile directly above it and nobody will be able to tell which is right. Copy those CTEs; do not re-derive them.

Watch the three traps documented in §2 of the architecture doc: SAP dates are `text` (`::date`), `sap_payment_applications` dates through `payment_ref → sap_payments.payment_date`, and `inv_type = 13` is the only enforcement of a polymorphic FK.

---

## Step 4 — 🛑 GATE: does anything beat the dumb method?

Backtest every SQL-expressible method against **seasonal-naive** (`lag(value, 12)`): rolling-origin, **≥12 origins**, horizons 1 and 3.

**Score with MAE and MASE, never MAPE.** MAPE is unstable when a month's actual is small and badly behaved on a lumpy revenue series — it returns a reassuring number while the model is useless. MASE is scaled against the naive method's own error, so below 1 literally means "better than naive". Track bias separately from error magnitude: a model 10% wrong in alternating directions and one 10% low every month have identical MAE and completely different business meaning.

**Publication rule:** a method ships only if MASE < 1 **and** it beats seasonal-naive at horizon 1 across origins.

**Two decisions come out of this gate:**

1. **Ship or don't.** If nothing beats seasonal-naive, **seasonal-naive is the shipped model** and this document says so without embarrassment. That is the correct outcome — it means the series is genuinely hard to improve on.
2. **SQL or Python.** If an SQL-expressible method wins, or ties within noise, **Path A — no Python is built.** Python is earned only by a fitted model (Holt-Winters, SARIMA) _materially_ beating everything SQL can express. The escalation path is documented in §10.4 of the architecture doc; do not take it on spec.

Record the bake-off table in §11.

---

## Step 5 — Phase 2: the projection itself

| File                                                | Note                                                                                                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/sql_editor/sales_projection_view.sql`     | `v_sales_monthly_projection` — point, `lo_80`/`hi_80`/`lo_95`/`hi_95`, `method`, `is_publishable`                                                                                                                                |
| `supabase/sql_editor/get_sales_projections_rpc.sql` | **Ship an explicit `drop function` header from day one.** `create or replace` with a changed signature leaves an orphaned overload and breaks PostgREST with `PGRST203`. Decide the final parameter list before the first paste. |

The RPC is SECURITY INVOKER, with the in-body role/department guard copied verbatim from `get_sales_reports_dashboard_rpc.sql`.

Intervals come from **empirical quantiles of the method's own historical residuals**, not a normality assumption — the band should reflect how wrong this method on this series has actually been.

---

## Step 6 — Phase 2: the frontend

| Piece              | Path                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| Fan chart renderer | `src/components/chartCard/FanChartRenderer.jsx` — **the one genuinely new component** |
| Page               | `src/pages/user/sales/projections/SalesProjections.jsx` + `config/`                   |
| Fetcher            | `src/features/sales/projections/private/api/fetchSalesProjections.js`                 |
| Route              | `src/routes/SalesRoutes.jsx`, gated `departments={["SAL","MGM","FIN"]}`               |

`FanChartRenderer` mechanics are in §7 of the architecture doc. The non-obvious parts: `band80` is a **two-element array** `[lo, hi]` (recharts renders a ranged area for tuple values); historical rows carry `band80: null` so the band starts exactly at the origin; duplicate the last actual into the `point` series so the dashed line attaches rather than floats; and **check `CustomTooltip` against an array value before wiring** — it's written for scalars.

Ship **tile 1** (Next Month — Projected Invoiced Revenue) and **tile 4** (Next 12 Months), **chart 1** (fan) and **chart 4** (seasonality profile). `invoiced` only.

Tiles are **informational blue, never the green/amber/red ramp** — §4 of `DASHBOARD-CONVENTIONS.md` reserves that for verdicts, and a projection has no good direction.

**Exit:** a live tile and fan chart on `/app/sales/projections`.

---

## Step 7 — 🛑 GATE: after three closed months, is it any good?

Add `sales_projection_snapshots` + its policies + `snapshot_sales_projections()` + the monthly `pg_cron` job, then the accuracy block in the same RPC, tile 6 and chart 5.

**Why the snapshot is not optional:** a live-computed projection silently rewrites its own history. Last month's projection for March is a different number this month, because new data arrived and the trend moved. Without a frozen record you are comparing a prediction against a moving target — no bias tracking, no FVA over time, no experience study. ~36 rows a year.

**After three closed months, read the realized accuracy and decide whether to keep the feature.** This is the gate most projects skip and the one that earns — or withdraws — executive trust.

---

## Steps 8–12 — the rest

| Step | Scope                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8    | Add `orders` and `collected` measures — tiles 2/3/5, charts 2/3/6                                                                                                                                                                  |
| 9    | Conversion triangle (Engine B) — chart 7. **Exit criterion is a consistency property, not an accuracy number:** projected collections must never exceed projected invoicing, which must never exceed bookings plus opening backlog |
| 10   | Finance series over `private.mv_gl_monthly_account_summary` — deliberately a _second_ number, not a replacement; GL and invoice-subledger revenue may disagree and both get labeled                                                |
| 11   | Doc updates: `DASHBOARD-CONVENTIONS.md` tag table (the **Projection** row), `RPC-REFERENCE.md`, `DASHBOARD-CURRENT-STATE.md`                                                                                                       |
| 12   | Supersession note on `hyrax-data-platform/docs/plans/10-*.md`                                                                                                                                                                      |

---

## Permanently out of scope

Recorded so it isn't re-proposed:

| Not built                                     | Reason                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Production** — batch yield, base-oil demand | `OWOR`/`WOR1` never extracted. Zero rows. An extraction problem, not a modelling one                                                                        |
| **Procurement** — PPV, supplier lead time     | Entire PO chain unextracted. Same                                                                                                                           |
| **Revenue net of returns**                    | `ORIN`/`RIN1` unextracted, so every series here is gross of credit memos — permanently, until that changes                                                  |
| **HR headcount / attrition**                  | ~100 employees, ~1 event a month. A model would fit noise; use a run-rate                                                                                   |
| **Cash flow**                                 | Driver-based off DSO/DPO/CCC — a different mechanism entirely                                                                                               |
| **Per-rep or per-product projections**        | `scope_key` leaves room, but splitting a lumpy series makes every sub-series lumpier. Revisit only if the company-wide projection passes Step 4 comfortably |

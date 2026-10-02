# Sales Projections — Deployment & Execution Guide

**Status: Step 1 of 12. Nothing is built.**

The design lives in [`docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md`](../sales/SALES-PROJECTIONS-ARCHITECTURE.md) — _what_ we're building and why. **This document is the ordered execution log** — what has actually been run, what comes next, and which steps are gates that can cancel the whole feature.

Everything in `supabase/` is hand-run in the Supabase SQL editor; editing a `.sql` file in this repo does **not** change production.

**Three steps are STOP gates** (2, 4, 7). Each can legitimately end this project. They exist so a model never reaches a dashboard on enthusiasm alone, and a "stop" outcome at any of them is a successful result, not a failure.

---

## Progress log

| Date       | What happened                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-01 | Architecture designed. Superseded `hyrax-data-platform/docs/plans/10-forecasting-predictive-analytics-plan.md`, which had been written without repo access against an unbuilt star schema. |
| 2026-10-01 | Phase 0 diagnostic SQL written: `supabase/diagnostics/sales_projection_phase0_evidence.sql`.                                                                                               |
| 2026-10-01 | **Phase 0 run — results INVALID.** See below.                                                                                                                                              |
| 2026-10-02 | Pipeline completeness repaired (`hyrax-data-platform/docs/plans/11-watermark-completeness-audit.md`). Prerequisite now met.                                                                |
| 2026-10-02 | **Step 0 passed** — `reconcile.py` clean. **Step 1 re-run** on reconciled data; §11 of the architecture doc filled in. **Step 2 gate: PROCEED WITH CAUTION** (avg top-3 concentration 31.2% over 24 complete months). |
| 2026-10-02 | **Step 3 views written** — series, decomposition, baseline, backtest. Not yet pasted into Supabase. |
| 2026-10-02 | **Phase A built and backtested.** Chain-ladder: unbiased from h=3 (+14% at h=1, correctable), 38% single-month error, owns 59.3% of next month. **Passes as an ensemble member.** Two defects found and fixed en route — survivorship bias in the development factors, and a lateral-join timeout. See architecture doc §11e. |
|            | **← you are here. Next: Phase B — the a-priori (frequency x severity + baseline).** |

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

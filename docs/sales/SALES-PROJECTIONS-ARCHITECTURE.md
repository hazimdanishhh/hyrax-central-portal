# Sales Projections Architecture — Ensemble Model

**Status: designed 2026-10-02, not built.** This is v2. The original design — a single seasonal-decomposition model on its own page — was tested and dropped; §11b records why, §11c the reframe. Sections 1–10 below are the replacement design. Sections 11–11d are the evidence that produced it, and should be read first by anyone questioning the choices here.

**Execution state and build order live in [`docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md`](../setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md).** This document is the design.

---

## 0. How this works — read this first

### The system has two halves

Everything in this document belongs to one of two jobs. Keeping them apart is
the key to understanding the file list.

**HALF 1 — SCORING. Looks backward. "How good is each model?"**
Take a month that has already closed. Ask each model what it *would* have
predicted, without letting it see the answer. Compare against what actually
happened. The output is accuracy numbers.

**HALF 2 — FORECASTING. Looks forward. "What will happen?"**
Each model predicts future months. Blend them into one number, weighting each
model by how accurate Half 1 proved it to be. The output is what reaches the
dashboard.

Half 1 exists so that no model ever reaches a dashboard on intuition. It is how
Engine A was dropped (§11b) and how the chain-ladder earned its place (§11e).

### Why some views look like near-duplicates

Because a model that predicts the *past* and a model that predicts the *future*
are different queries, even when the method is identical.

`v_sales_projection_baseline` predicts closed months so it can be scored, so it
carries an `actual` column:

| period_month | horizon | method | predicted | actual |
| --- | --- | --- | --- | --- |
| 2026-09 | 1 | ma12 | 3.1M | 2.3M |
| 2026-09 | 1 | seasonal_naive | 5.8M | 2.3M |

`v_sales_model_chainladder` predicts future months so it can be shown, and
there is no actual to carry:

| period_month | horizon | model | predicted | variance |
| --- | --- | --- | --- | --- |
| 2026-11 | 1 | chainladder | 4.45M | … |

Same idea, two shapes, two purposes. **The practical consequence right now:
`ma12` only exists in backward-looking form.** Nothing yet says what `ma12`
predicts for November 2026, and the ensemble needs a forward prediction from
every model. Building that forward twin is Phase B, not a rewrite — the
scoring view stays exactly as it is.

### The whole picture

```mermaid
flowchart TB
    A1[(sap_invoices)]
    A2[(sap_sales_orders)]
    A3[(sap_invoice_lines)]

    SERIES["v_sales_monthly_series<br/>the canonical series<br/>everything reads this"]

    A1 --> SERIES
    A2 --> SERIES
    A3 --> SERIES

    subgraph H1["HALF 1 - SCORING - how good is each model"]
        B1["v_sales_projection_baseline<br/>6 candidate methods<br/>PAST months + actual"]
        B2["v_sales_projection_backtest<br/>MAE / MASE / bias"]
        B3["v_sales_chainladder_backtest<br/>chain-ladder bias by horizon"]
        B1 --> B2
    end

    subgraph INPUTS["inputs to the order-book model"]
        D1["v_sales_order_development<br/>link ratios by order age"]
        D2["v_sales_orderbook_open<br/>open orders + remaining value"]
    end

    subgraph H2["HALF 2 - FORECASTING - what will happen"]
        C1["v_sales_model_chainladder<br/>S5.1 order book"]
        C2["v_sales_model_baseline<br/>S5.4 ma12"]
        C3["v_sales_model_freqsev<br/>S5.2 frequency x severity"]
        C4["v_sales_model_cohort<br/>S5.3 customer cohort"]
    end

    COV["v_sales_coverage_by_horizon<br/>how much is knowable h months out"]
    ENS["v_sales_projection_ensemble<br/>Bornhuetter-Ferguson blend<br/>+ asymmetric intervals"]
    RPC["get_sales_projections()"]
    DASH(["Sales Reports page"])

    SERIES --> B1
    SERIES --> C2
    SERIES --> C3
    SERIES --> C4
    A2 --> D1
    A2 --> D2
    A3 --> D1
    A3 --> D2
    D1 --> C1
    D2 --> C1
    D1 --> B3
    SERIES --> COV

    C1 --> ENS
    C2 --> ENS
    C3 --> ENS
    C4 --> ENS
    COV --> ENS
    B2 -. accuracy weights .-> ENS
    B3 -. accuracy weights .-> ENS

    ENS --> RPC --> DASH

    classDef built fill:#1f7a4d,stroke:#0d4a2b,color:#ffffff
    classDef todo fill:#7a5a1f,stroke:#4a360d,color:#ffffff,stroke-dasharray: 4 3
    classDef src fill:#2b4a7a,stroke:#16304f,color:#ffffff

    class A1,A2,A3 src
    class SERIES,B1,B2,B3,D1,D2,C1,COV built
    class C2,C3,C4,ENS,RPC,DASH todo
```

Green is built. Amber dashed is not built yet. Blue is SAP data that already
arrives through the pipeline.

### What exists today, in plain terms

| Thing | Built? | What it does |
| --- | --- | --- |
| The canonical series | ✅ | One agreed definition of monthly revenue, used by everything |
| The scoring harness | ✅ | Proves whether a model is any good before it ships |
| Order-book model (§5.1) | ✅ | Projects invoicing from orders already placed. Owns 59% of next month |
| `coverage(h)` | ✅ | Measures how much of a month is knowable *h* months ahead — drives the blend |
| Seasonal decomposition | ⚪ | **Retired.** Lost the bake-off; kept as the evidence for why |
| Baseline `ma12` forward | ⬜ | **Phase B** |
| Frequency × Severity | ⬜ | **Phase B** — supplies the honest, asymmetric uncertainty |
| Customer cohort | ⬜ | Phase F — the only model reaching the 28% with no sales order |
| The blend | ⬜ | Phase C |
| RPC + dashboard | ⬜ | Phase D |

**Two of four models built. Shared plumbing done. Scoring harness done.**
Four files stand between here and a number on a screen: two in Phase B, the
blend in Phase C, the RPC in Phase D.

---

## 1. What this is, in one paragraph

A forward projection of monthly invoiced revenue, 1–12 months ahead, produced by **four independent models blended into one number with an honest uncertainty range**. No single method is trusted. Near-term the blend leans on orders already booked; further out it leans on statistical expectation, with the transition governed by how much is actually observable at that horizon rather than by an arbitrary cutoff. Every component is visible on the dashboard, so the number can be challenged rather than merely believed.

It is **purely informational** — no targets are set from it, nobody is measured against it, and there is no human override. That is a deliberate scope choice (confirmed 2026-10-02) and it removes the need for an approval workflow or an adjustment audit trail.

---

## 2. Why an ensemble, and not a better single model

Three findings from Steps 1–5 forced this shape. Each is measured, not assumed.

**Revenue cannot be extrapolated from its own history.** Six methods were backtested over 106 rolling origins (§11b). The winner was a plain 12-month moving average, at a 37.6% average absolute error — roughly 70% against 2026's smaller months. The seasonal model this project was originally built around came fourth. There is one reliable seasonal month out of twelve.

**But most of a month is already observable.** About 60% of invoiced value in any month was already sitting in the order book when the month began (§11d). That is fact, not extrapolation, and a time-series model throws all of it away.

**And no single source covers the whole picture.** The order book reaches about four months and misses the 27.4% of revenue invoiced with no sales order at all. Statistical methods cover every horizon but carry large error. Customer history explains repeat business the order book never sees.

Forecast combination reducing error is one of the most replicated results in the forecasting literature, and the **disagreement between methods is itself information**: when four independent approaches converge the interval is tight; when they diverge the number is genuinely uncertain and should say so.

**What an ensemble will not do** is manufacture signal that is not there. Expect meaningfully better than 37.6% for next month — plausibly 15–25% — and materially worse as the horizon extends. Anyone promising a few percent on a tender-driven series is wrong.

---

## 3. Vocabulary — four forward-looking numbers, never blended

Extends `DASHBOARD-CONVENTIONS.md`'s canonical tag table. All four may appear on Sales Reports; none is ever reconciled into another.

| Tag                    | Source             | Nature                          | Who sets it       |
| ---------------------- | ------------------ | ------------------------------- | ----------------- |
| **Target**             | `sales_targets`    | CRM quota per rep/month         | A human           |
| **Budget**             | `sales_budgets`    | SAP-invoice quota per rep/month | A human           |
| **Order Book**         | `sap_sales_orders` | Committed, not yet invoiced     | A customer        |
| **Projection** _(new)_ | the ensemble       | Statistical, with an interval   | Nobody — computed |

The existing rule stands: two figures may legitimately disagree; label both sides so the difference is visible, never silently pick one or blend them.

---

## 4. The measure

**Monthly invoiced revenue** (`sap_invoices`, `is_cancelled = 'N'`, `total_amount_myr`, dated by `invoice_date::date`) is the only measure projected in v2.

Orders and collections remain in `v_sales_monthly_series` because the models read them as inputs, but they are not themselves projected. Scope discipline: one number done properly beats three done partially.

---

## 5. The models

Four active, one reserved. Each is an independent view producing `(period_month, horizon, model, predicted, variance)`.

### 5.1 Chain-ladder on the order book — horizons 1–4

The actuarial run-off triangle, applied to orders instead of claims.

Every open order has an age and a remaining uninvoiced value. History tells us what fraction of an order's value converts at each month of age (Q4):

| Lag | Converts | Cumulative |
| --- | -------- | ---------- |
| 0   | 17.0%    | 17%        |
| 1   | 28.6%    | 46%        |
| 2   | 14.4%    | 60%        |
| 3–4 | 19.4%    | 80%        |
| 5–7 | 11.5%    | 91%        |

For an order of age _a_ with remaining value _R_, expected conversion next month is `R × f(a+1) ÷ (1 − F(a))` — the standard conditional development factor: the share of what has _not yet_ converted that converts next.

**Remaining value** comes from `sap_sales_orders_with_fulfillment.total_invoiced_myr` against `total_amount_myr`. ⚠️ That column sums _whole invoices_ per order, so if one invoice draws on several orders it will over-count. **Verify at line level before relying on it** — if it over-counts, compute remaining from `sap_invoice_lines` where `base_type = 17` instead.

**`delivery_date` is deliberately unused.** 90.6% of the open book is past its delivery date, 56.9% by more than 90 days (Q6). Those dates are not maintained; age-based development is the only reliable timing signal.

### 5.2 Frequency × Severity — all horizons

The collective risk model, and the piece that makes the intervals honest.

Monthly invoice **count** is stable (82–131). Invoice **values** are wildly volatile. Modelling total revenue directly blends a predictable signal with a noisy one and loses both. Split them:

```
E[Revenue]   = E[N] × E[X]
Var[Revenue] = E[N]·Var[X] + Var[N]·E[X]²
```

Closed-form, so it runs in SQL with no simulation. `N` from a trailing count mean; `X` mean and variance from trailing invoice values.

This matters beyond tidiness: it produces an **asymmetric** interval. Downside is bounded — revenue cannot fall far below the committed order book — while upside is a fat tail, because one large tender can land. A symmetric ±band misrepresents that. It also makes the interval widen _for the right reason_: when a month depends on a few large invoices, which is the real business risk.

### 5.3 Customer cohort — horizons 3–12

Retention × frequency × spend over 108 months of purchase history.

> Of customers who bought in the last 12 months, what share buy again in a given month, how often, and for how much?

`E[revenue] = Σ over active customers of P(purchases in month) × E[spend | purchase]`

**This is the only model that reaches the 27.4% of revenue with no sales order behind it.** That is almost certainly repeat customers reordering informally — a retention problem, not a pipeline problem. Grouped by customer segment rather than individual customer, to avoid fitting noise on small accounts.

### 5.4 Statistical baseline — all horizons

`ma12`, the trailing 12-month mean. Won the Step 4 bake-off (MASE 0.760 at horizon 1, 0.811 at horizon 3, best on all three measures).

Its job in the ensemble is to catch whatever the structural models miss, and to anchor long horizons where the order book is empty. Already built and validated in `v_sales_projection_baseline`.

### 5.5 Pipeline conversion — reserved, weight ≈ 0

`sales_leads` weighted by calibrated win rates.

**Not weighted at launch.** `sales_leads` has roughly two months of history and a sales cycle longer than that, so almost nothing has closed — there is nothing to calibrate against, and an uncalibrated pipeline model imports self-reported optimism directly into the forecast.

Its weight is **computed from the volume of closed leads in the calibration window**, so it rises on its own as history accumulates. No redesign, no code change. The dashboard shows it honestly: _"Pipeline: insufficient history (2 months) — weight 0%."_

---

## 6. Combination — Bornhuetter-Ferguson credibility

The models are not averaged. They are blended by **how much is actually known at that horizon**, which is the Bornhuetter-Ferguson mechanism.

```
Projection(m, h) = OrderBook(m) + (1 − coverage(h)) × APriori(m, h)
```

- **`OrderBook(m)`** — §5.1's chain-ladder estimate. Zero beyond about four months.
- **`coverage(h)`** — the historically measured share of a month's invoicing already in the book _h_ months ahead. Measured, not chosen. At h=1 it is ~60% (§11d); it decays toward 0 as _h_ grows.
- **`APriori(m, h)`** — the blend of §5.2–5.4, weighted by inverse historical MAE from the backtest, floored so no single model dominates.

This gives exactly the behaviour the business needs without arbitrary switching: next month leans on committed orders, month nine leans on statistical expectation, and the transition is smooth and justified.

**Each horizon gets its own `coverage(h)`**, measured the same way Q3 measured h=0. That measurement is a prerequisite, not an assumption.

---

## 7. Uncertainty

Total variance decomposes into two sources, reported separately because they mean different things:

| Source            | What it is                                                            | What a large value means                        |
| ----------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| **Within-model**  | §5.2's `Var[Revenue]`, plus each model's historical residual variance | The business is inherently lumpy this month     |
| **Between-model** | Variance of the models' point estimates around the blend              | The methods disagree — the situation is unusual |

`Total = within + between`. Intervals at 80% and 95% from a gamma or lognormal matched to the blended mean and variance — **not a normal**, because the distribution is right-skewed by the fat upper tail.

**Between-model spread is surfaced as its own KPI.** Tight agreement is evidence; wide disagreement is a warning. Hiding it behind a single confident number would be the dishonest choice.

---

## 8. Object inventory

Every file and view in this feature, what it is for, and whether it feeds the
forecast. All in `hyrax-central-portal`; all views are `security_invoker = on`;
all SQL is hand-pasted into the Supabase SQL editor.

**Statuses:** ✅ built and in use · 🔵 scoring harness (validates models, never
produces a published number) · ⚪ evidence only (settled a decision, retained as
the record) · ⬜ not built yet.

### 8.1 Shared input — read by everything

| File | View | Status | Why it exists |
|---|---|---|---|
| `sql_editor/sales_projection_series_view.sql` | `v_sales_monthly_series` | ✅ | The canonical monthly series for all three measures. Filters copied verbatim from `base_invoices`/`base_orders`/`base_payment_apps` in `get_sales_reports_dashboard_rpc.sql`, so the projection can never disagree with the actuals tile above it. Carries a `generate_series` spine (a missing month would silently shift every `lag(value, 12)`) and an `is_complete` flag (the current month is always partial). **Every other view here reads this one.** |

### 8.2 The models

Each produces, or will produce, `(period_month, horizon, model, predicted, variance)`.

| File | View | Model | Status | Why it exists |
|---|---|---|---|---|
| `sql_editor/sales_order_development_view.sql` | `v_sales_order_development` | — *(input to §5.1)* | ✅ | Chain-ladder **link ratios**: of order value still outstanding at age *a*, what share converts at *a+1*. Rebuilt 2026-10-02 from the original share-of-original formulation, which carried survivorship bias (§11e). `survival_log` supports the model's survival product. |
| `sql_editor/sales_orderbook_open_view.sql` | `v_sales_orderbook_open` | — *(input to §5.1)* | ✅ | Orders still carrying uninvoiced value, with age. Remaining value computed at **line level** — deliberately not `sap_sales_orders_with_fulfillment.total_invoiced_myr`, which over-states (see `DASHBOARD-ROADMAP.md` §4 Group C). "Open" means remaining value, not `status_code`, which Q6 showed is unmaintained. |
| `sql_editor/sales_model_chainladder_view.sql` | `v_sales_model_chainladder` | **§5.1 Chain-ladder** | ✅ | Expected invoicing from orders **already placed**. Owns 59.3% of next month, decaying to 16.3% by month six. Unbiased from h=3, +14% at h=1 (§11e). Cannot see unwon business or the 28% with no order — by design. |
| `sql_editor/sales_projection_baseline_view.sql` | `v_sales_projection_baseline` | **§5.4 `ma12`** *(plus five comparators)* | ✅ | **Badly named — it holds six methods, not one.** `seasonal_naive`, `seasonal_naive_drift`, `ma3`, `ma12`, `drift`, `decomposition`. Only **`ma12`** is promoted into the ensemble as §5.4; it won the Step 4 bake-off at MASE 0.760. The other five stay as FVA comparators so Phase C can prove the ensemble beats its parts. |
| *(Phase B)* | `v_sales_model_freqsev` | **§5.2 Frequency × Severity** | ⬜ | Splits stable invoice *counts* from volatile invoice *values*. Supplies the **asymmetric interval** via the collective risk model — closed-form, no simulation. |
| *(Phase F)* | `v_sales_model_cohort` | **§5.3 Customer cohort** | ⬜ | Retention × frequency × spend over 108 months. **The only model that reaches the 28% of revenue with no sales order.** |
| *(Phase G)* | — | **§5.5 Pipeline** | ⬜ | Reserved. Weight computed from closed-lead volume, currently ≈ 0. |

### 8.3 The blend

| File | View | Status | Why it exists |
|---|---|---|---|
| `sql_editor/sales_coverage_by_horizon_view.sql` | `v_sales_coverage_by_horizon` | ✅ | `coverage(h)` — the measured share of a month's invoicing already visible *h* months ahead. **Drives the Bornhuetter-Ferguson weight in §6.** 63.1% at h=1 falling to 3.0% at h=12; independently corroborated at 59.3% by A11. Measured, never chosen. |
| *(Phase C)* | `v_sales_projection_ensemble` | ⬜ | The §6 blend and §7 intervals. Applies per-horizon calibration from §11e's A9. |

### 8.4 Scoring harness — validates, never publishes

These exist so no model reaches a dashboard on intuition. Phase C's gate runs
through them.

| File | View | Status | Why it exists |
|---|---|---|---|
| `sql_editor/sales_projection_backtest_view.sql` | `v_sales_projection_backtest` | 🔵 | Rolling-origin MAE/MASE/bias for the six candidate methods. Produced the Step 4 result that killed Engine A. MAPE is deliberately absent so nobody can quote it. |
| `sql_editor/sales_chainladder_backtest_view.sql` | `v_sales_chainladder_backtest` | 🔵 | Scores the chain-ladder at historical origins with a **point-in-time order book reconstruction**. Produced §11e's bias table. Phase E reuses the reconstruction for accuracy tracking. |

### 8.5 Evidence only — retired, retained

| File | Views | Status | Why it is kept |
|---|---|---|---|
| `sql_editor/sales_projection_decomposition_view.sql` | `v_sales_monthly_trend`, `v_sales_seasonal_index` | ⚪ | **Engine A, dropped.** Its centred 2×12 moving average contains lookahead by construction, so it was never usable for backtesting — descriptive only. It is retained because it is the evidence that seasonality does not pay here: one reliable month in twelve (April 0.621 ± 0.094), March unusable (1.605 ± 1.593), October's apparent peak revealed as trend leakage. Anyone reopening the seasonality question starts here. |

### 8.6 Delivery — none built

| File | Object | Phase | Why it exists |
|---|---|---|---|
| `sql_editor/get_sales_projections_rpc.sql` | `get_sales_projections(...)` | D | One JSON blob for the dashboard. Own RPC, not an extension of the 1,638-line Sales RPC. Explicit `drop function` header — a changed signature on `create or replace` leaves an orphaned overload and breaks PostgREST with `PGRST203`. |
| `sql_editor/sales_projection_snapshots_migration.sql` | `sales_projection_snapshots` | E | Frozen monthly record. **Not optional** — a live-computed projection rewrites its own history, so without it accuracy is measured against a moving target. |
| `src/components/chartCard/FanChartRenderer.jsx` | — | D | The one genuinely new component. No `Area`/`ComposedChart` exists in `chartCard/` today. |

### 8.7 Diagnostics — evidence behind every decision

Not deployed objects; run by hand, results in
`supabase/diagnostics/results/projection/`.

| File | Produced |
|---|---|
| `diagnostics/sales_projection_phase0_evidence.sql` | §11 — depth, concentration, structural break, raw seasonality |
| `diagnostics/sales_projection_step3_verification.sql` | §11b — the six-method bake-off that dropped Engine A |
| `diagnostics/sales_projection_orderbook_signal.sql` | §11d — coverage, conversion lag, order-book health |
| `diagnostics/sales_projection_phaseA_verification.sql` | §11e — link ratios, chain-ladder bias, coverage cross-check |

### 8.8 What Phase B adds, and why it is not a rewrite

`v_sales_projection_baseline` is a **scoring** view: it predicts closed months
and carries an `actual` column so the backtest can grade it (§0). That is a
real job and it keeps doing it, unchanged.

But the ensemble needs **forward** predictions, and `ma12` has none. Nothing in
the database currently says what `ma12` predicts for November 2026 — only what
it would have predicted for months that have already happened.

So Phase B **adds** two forward-looking views; it does not modify or replace
anything:

| New file | New view | Model |
| --- | --- | --- |
| `sql_editor/sales_model_baseline_view.sql` | `v_sales_model_baseline` | §5.4 — `ma12`, forward |
| `sql_editor/sales_model_freqsev_view.sql` | `v_sales_model_freqsev` | §5.2 — frequency × severity, forward, with variance |

Both emit the same shape as `v_sales_model_chainladder`
(`period_month, horizon, model, predicted, variance`), so §6's blend can union
all models without special-casing any of them. The `variance` column is what
§7's within-model uncertainty term reads.

**One naming cleanup, deferred deliberately.**
`sales_projection_decomposition_view.sql` is retired (§8.5) but its filename
does not say so. Renaming a file that has already been hand-pasted into
Supabase buys nothing — the views would keep their names regardless — so it
carries a status banner in its header instead. Mentioned here only so the
inconsistency is known rather than mistaken for an oversight.

## 9. On Sales Reports — not a separate page

**Decision reversed 2026-10-02.** v1 put this on its own page, arguing different epistemic status. That was wrong twice over: the source-labeling rule exists precisely so differently-sourced numbers can sit together safely, and Sales Reports already carries Target and Budget. A separate page would split the forward view across two screens.

**Same page, separate RPC.** `get_sales_reports_dashboard` is 1,638 lines at 52 JSON pairs, already split into four blocks against the argument ceiling. The page calls a second RPC with its own query key and `staleTime` — different cadence, and a projection failure leaves the rest of the page intact.

### KPI tiles

| #   | Tile                                           | Value                                          | Sub-metrics                                                  | Variant            |
| --- | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | ------------------ |
| 1   | **Next Month — Projected Revenue**             | selected estimate                              | 80% range · vs Budget · vs same month last year · coverage % | Informational blue |
| 2   | **Next 12 Months — Projected Revenue**         | sum over horizon                               | 80% range · growth vs trailing 12                            | Informational blue |
| 3   | **Forecast Confidence**                        | model agreement (inverse between-model spread) | the widest-disagreeing model pair                            | `target-band`      |
| 4   | **Projection Accuracy — last 3 closed months** | MASE                                           | MAE in MYR · bias direction · beats baseline Y/N             | `target-band`      |

Tiles 1–2 are **informational blue, never the green/amber/red ramp** — §4 of `DASHBOARD-CONVENTIONS.md` reserves that for verdicts, and a projection has no good direction. Tiles 3–4 _are_ verdicts and earn colour.

### Charts

| #   | Chart                                                                                             | Renderer                     | Why it exists                                                                          |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| 1   | **Projection fan** — 24 months actual + 12 forward, 80/95 bands                                   | `FanChartRenderer` _(new)_   | The headline                                                                           |
| 2   | **Method selection exhibit** — what each model says for the selected month, with the blend marked | `HorizontalBarChartRenderer` | **The actuarial exhibit.** Makes the number challengeable instead of merely believable |
| 3   | **Build-up bridge** — committed order book → a-priori → total                                     | `HorizontalBarChartRenderer` | Explains the number at a glance: how much is known versus predicted                    |
| 4   | **Actual vs Expected** — snapshot versus realised, per closed month                               | `LineChartRenderer`          | The experience study. What earns trust, and what says when to stop believing it        |

Charts 2 and 3 are what make this actuarial rather than a black box. **An actuary never shows only the answer** — a reserving exhibit shows each method's indication, the selection, and the reasoning. Ship those two, or the dashboard is just a line with no defence.

---

## 10. Build order

Each phase ends somewhere coherent; none is wasted if the next is deferred.

| Phase              | Scope                                                                                                                                                                    | Exit                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **A — Order book** | Verify `total_invoiced_myr` at line level. Build `v_sales_order_development`, `v_sales_orderbook_open`, `v_sales_model_chainladder`. Measure `coverage(h)` for h = 1..12 | Chain-ladder scores in the backtest harness                                                        |
| **B — A-priori**   | `v_sales_model_freqsev` with variance; reuse `ma12`. Score both                                                                                                          | Three models scored on the same origins                                                            |
| **C — Ensemble**   | `v_sales_coverage_by_horizon`, `v_sales_projection_ensemble` with the BF blend and intervals                                                                             | **Gate: ensemble MASE beats every individual member.** If not, ship the best single model and stop |
| **D — Dashboard**  | RPC, `FanChartRenderer`, tiles 1–2, charts 1–3 on Sales Reports                                                                                                          | Live on `/app/sales/reports`                                                                       |
| **E — Accuracy**   | Snapshot table, `pg_cron` monthly freeze, tiles 3–4, chart 4                                                                                                             | One real accuracy figure after a closed month                                                      |
| **F — Cohort**     | `v_sales_model_cohort`, added to the blend                                                                                                                               | Direct-sales share measurably better explained                                                     |
| **G — Pipeline**   | §5.5, once closed-lead volume supports calibration                                                                                                                       | Weight rises above 0 on its own                                                                    |

**Phase C is a real gate.** Ensemble combination usually beats its members, but not always — if it doesn't here, the honest outcome is to ship the single best model and record why.

---

## 11d. Order-book evidence (Step 5, 2026-10-02)

Measured by `supabase/diagnostics/sales_projection_orderbook_signal.sql`; results in `supabase/diagnostics/results/projection/orderbook/`.

**Coverage — the decision number (Q3):**

| Window            | Already booked at month start | Ordered & invoiced same month | No order at all |
| ----------------- | ----------------------------- | ----------------------------- | --------------- |
| 2023-01 → 2026-09 | **60.1%**                     | 12.3%                         | 27.4%           |
| Last 12 months    | 54.0%                         | 19.1%                         | 26.9%           |
| 2026 YTD          | 63.6%                         | 21.1%                         | 15.3%           |

Per-month range 22.8%–93.8%, median about 61%. This sits in the "partial signal — build it, show the gap honestly" band.

**Ceiling (Q2):** 72.6% of invoiced value traces to a sales order; 27.4% is direct with no preceding document. No order-based model can exceed that, which is why §5.3 exists.

**Development pattern (Q4):** 46% of order value invoices within one month, 60% within two, 80% within four, 91% within seven. A short-range predictor — which is why §6 hands over to the a-priori as the horizon extends.

**Order book health (Q6) — the constraint:**

|                              | % of open book |
| ---------------------------- | -------------- |
| Overdue                      | **90.6%**      |
| — of which more than 90 days | 56.9%          |
| Due in future                | 9.5%           |

Only RM2.95M of a RM31.2M open book has a delivery date still ahead of it; Q5 shows orders with 2024 delivery months still open. **`delivery_date` is therefore unusable for timing**, and §5.1 uses age-based development instead.

This is also a finding in its own right, independent of forecasting: either stale orders are not being closed in SAP, or there is a real fulfilment backlog. Worth raising with Operations either way.

---

## 11e. Phase A findings — the chain-ladder, measured (2026-10-02)

Built, rebuilt once, and backtested. Results in
`supabase/diagnostics/results/projection/phase-A-verification/`.

### Verdict: passes as an ensemble member. Proceed to Phase B.

Unbiased from three months out, correctable at one month, and owning 59% of
next month from committed fact rather than extrapolation. Too noisy to carry
the forecast alone — which is why the design has three other models.

### What it does, in one sentence

Of the value sitting in open orders, how much converts to an invoice in each of
the next twelve months — using measured conversion rates by order age.

### Measured bias (A9)

| Horizon | Bias | MAE | Origins |
|---|---|---|---|
| 1 | **+14.0%** | RM1.19M | 29 |
| 2 | +11.7% | RM0.86M | 28 |
| 3 | +5.3% | RM0.74M | 27 |
| 4 | −2.3% | RM0.57M | 26 |
| 5 | −3.1% | RM0.47M | 25 |
| 6 | −4.7% | RM0.40M | 24 |

Scored against `target_known_orders` — invoicing from orders the model could
actually see at the origin. Scoring against total invoicing would build in a
guaranteed shortfall, since 28% of revenue has no sales order at all.

### Right total, wrong month (A10)

Bias at horizon 1 swings from **−42% to +332%** across origins. MAE is RM1.19M
against an average RM3.09M of known-order invoicing — **38% relative error**,
about the same as the `ma12` baseline achieves on total revenue.

**This is the classic signature of chain-ladder applied at too fine a grain.**
The method was built for insurance reserving, where it estimates the *ultimate*
total and relies on many claims averaging out. Asking it which single month a
small number of large orders will land in exposes exactly the timing noise it
normally smooths away. Bias near zero with high variance is what that looks
like, and it is not evidence of a defect.

**Design implication:** the 12-month total should be materially more reliable
than any single month, because timing errors partly cancel when months are
summed. Phase C should measure that rather than assume it — if it holds, the
annual KPI deserves more prominence than the next-month KPI.

**Errors are asymmetric.** Nine of 29 origins over-predicted by more than 50%;
**none** under-predicted by more than 50%. Over-prediction is unbounded — a
large order sits and does not convert — while under-prediction is bounded,
since actuals can only exceed the book by so much. This is direct empirical
support for §7's asymmetric interval; a symmetric band would misrepresent it.

### What the order book can and cannot explain (A11)

| Horizon | From known orders | From orders placed later | No order at all |
|---|---|---|---|
| 1 | **59.3%** | 12.6% | 28.1% |
| 2 | 39.5% | 31.6% | 28.9% |
| 3 | 30.9% | 41.0% | 28.2% |
| 6 | 16.3% | 56.5% | 27.2% |

**Two independent measurements of coverage agree:** 59.3% here against 63.1%
from `v_sales_coverage_by_horizon` (A8), computed by different routes. And
`none_pct` holds at ~28% at every horizon, matching Q2's 27.4%. The §6 blend
weight can be trusted.

**This reprices Phase B.** The a-priori is not a fallback for long horizons —
it carries 41% of next month and 84% of month six. Frequency × Severity and
the baseline now matter more than the order book beyond the near term.

### Two corrections made during Phase A, both worth keeping

**1. Survivorship bias in the development factors.** The first version measured
incremental shares of *original* order value and applied `f(a+h) / (1 − F(a))`
to each open order's remaining balance. Those factors are estimated across all
orders, most of which convert on schedule — but orders still open at age *a*
are precisely the ones that did not. Rebuilt on **link ratios**: of value still
outstanding at age *a*, what share converts at *a+1*. Estimated on survivors,
applied to survivors, so the selection effect cancels. It also removed the need
for the `min_undeveloped` floor, since link ratios carry no divisor that can
approach zero.

**2. A performance defect that timed out.** Survival was expressed as a
`CROSS JOIN LATERAL` re-querying the development view once per
(order × horizon) — ~270,000 correlated subqueries, each re-evaluating a view
that scans `sap_sales_orders` and `sap_invoice_lines` with window functions,
because PostgreSQL inlines ordinary CTEs. Replaced with a **prefix sum of
log(1−r)** against an `AS MATERIALIZED` CTE: survival across *k* months becomes
`exp(cum_log(a+k) − cum_log(a))`, two joins and a subtraction.

### A judgement error worth recording

A6's forward projection (RM4.45M) was compared against a benchmark of
"~RM2.6M" derived from 2026's depressed revenue, and the model was declared
~70% biased. The backtest window averages **RM5.2M/month** — it spans 2024–25,
when the business was substantially larger. A forward projection was being
judged against a benchmark from a different era.

The measured bias is +14%, not +70%. **The lesson is the one Phase A's exit
criterion already encoded: score the model, do not reason about it from
aggregates.** Two rebuilds were spent chasing an error that measurement would
have ruled out first.

### Carried into Phase C

- **Per-horizon calibration factors from A9**, applied in the ensemble rather
  than by tweaking link ratios. This is the actuarial "indicated versus
  selected" adjustment — visible and auditable instead of buried in a parameter.
- **Test whether multi-month totals are more accurate than single months.** If
  the timing-noise hypothesis holds, the 12-month KPI is the trustworthy one
  and should lead the dashboard.

---

## 11. Phase 0 findings

> **Run 2026-10-02 against reconciled data.** Source:
> `supabase/diagnostics/sales_projection_phase0_evidence.sql`, results in
> `supabase/diagnostics/results/projection/`. Step 0 (`reconcile.py`) confirmed
> every relevant table at `+0` against SAP before these were measured. This
> replaces the 2026-10-01 pass, which ran on incomplete data and was discarded.

### Series depth (block 1)

| measure   | first_month | last_month | months_present | months_in_span | total_docs | total_myr   |
| --------- | ----------- | ---------- | -------------- | -------------- | ---------- | ----------- |
| orders    | 2017-11     | 2026-10    | 108            | 108            | 13,180     | 566,871,985 |
| invoiced  | 2011-02     | 2026-10    | 141            | 189            | 22,596     | 754,116,468 |
| collected | 2017-11     | 2026-10    | 108            | 108            | 18,191     | 568,099,954 |

**No calendar gaps in the usable range.** `orders` and `collected` are dense
across all 108 months. `invoiced` shows 48 "missing" months, but block 3 places
every one of them before 2017 — 2011 has a single invoice, 2013 three, 2014
six, 2015 and 2016 ten months each totalling RM260k and RM2.6M against RM42.4M
in 2017. That is a partial SAP rollout, not a business.

**Series start is 2017-11**, where all three measures begin. 108 months against
the 24–36 a seasonal method needs.

### Concentration verdict (block 2b)

The raw block-2b row reads `avg_top3_share_pct = 34.0` over 25 months, but that
includes the current month at one day old (4 invoices, top-3 share 99.8%).
Excluding it, over the 24 complete months:

| months | avg top-3 | min   | max   | over 40%      | avg top-10 | invoices/month |
| ------ | --------- | ----- | ----- | ------------- | ---------- | -------------- |
| 24     | **31.2%** | 12.3% | 61.0% | 5 of 24 (21%) | 58.1%      | 105 (82–131)   |

**Verdict: PROCEED WITH CAUTION.** Mid-band. Intervals will be wide and should
be.

**The concentration is real, not an artifact of the pipeline defect.** This was
the expectation going in — missing rows inflate concentration, so the repaired
figure should have fallen. It barely moved (31.9% → 31.2%), and the reason
matters: the months that drove the average were never affected. The five months
above 40% are 2024-12 (54.3%), 2025-02 (51.9%), 2025-03 (61.0%), 2026-01 (40.9%)
and 2026-06 (41.7%) — all fully synced throughout. The two months the defect did
distort improved sharply once repaired (2026-08: 42.8% → 27.1%; 2026-09: 43.9% →
20.1%), but they were never the problem.

So roughly one month in five is genuinely tender-dominated. A volume of ~105
invoices a month is a healthy book, not a handful of documents, which is what
keeps this in the caution band rather than the stop band.

### Structural break — the finding that constrains the model (block 3)

| year        | invoices | avg invoice | annual MYR      |
| ----------- | -------- | ----------- | --------------- |
| 2018        | 4,009    | 22,547      | 90,391,131      |
| 2019        | 3,999    | 23,542      | 94,143,838      |
| 2020        | 2,415    | 30,554      | 73,788,783      |
| 2021        | 1,787    | 65,441      | **116,942,909** |
| 2022        | 1,666    | 40,781      | 67,940,495      |
| 2023        | 1,479    | 52,209      | 77,216,622      |
| 2024        | 1,300    | 64,765      | 84,195,038      |
| 2025        | 1,340    | 53,936      | 72,274,461      |
| 2026 (10mo) | 836      | 37,837      | 31,632,075      |

Two separate things are happening.

**A slow structural shift, 2018 → 2024.** Invoice count fell from 4,009 to
1,300 while average invoice value tripled — the business moved from many small
invoices to fewer large ones, at roughly flat revenue. This is why concentration
is structurally rising, and why the training window must be recent.

**A sharp decline in 2026.** Like-for-like January–September:

|                   | 2025       | 2026       | change     |
| ----------------- | ---------- | ---------- | ---------- |
| revenue           | 49,366,147 | 31,554,046 | **−36.1%** |
| invoices          | 974        | 832        | −14.6%     |
| avg invoice value | 50,684     | 37,926     | **−25.2%** |

This is reconciled data — it is not the pipeline defect, which is already
repaired and verified at `+0`. Volume is down 15% while average deal size is
down 25%, so the decline is mostly in deal size rather than deal count.

**2021 is an outlier year** (RM116.9M against RM68–94M neighbours) and should be
excluded from any training window, which a 24–36 month window does anyway.

### Seasonality (block 4)

Raw, un-detrended index over the trailing 60 months:

| month   | index     |     | month   | index     |
| ------- | --------- | --- | ------- | --------- |
| Jan     | 1.053     |     | Jul     | 1.041     |
| Feb     | 0.989     |     | Aug     | 1.172     |
| **Mar** | **1.236** |     | Sep     | 0.937     |
| **Apr** | **0.577** |     | **Oct** | **1.312** |
| May     | 0.917     |     | Nov     | 1.049     |
| Jun     | 0.740     |     | Dec     | 0.976     |

**April is the lowest month; March is the second-highest.** Hyrax's fiscal year
runs April–March (hence `FiscalYearFilterBar.jsx`), so this is a fiscal
year-end push followed by a new-year lull — **a pattern with a known mechanism,
not one a model merely found.** That is the strongest evidence in this whole
phase that Engine A has something real to work with.

The index is essentially unchanged from the pre-repair run (Apr 0.582 → 0.577,
Mar 1.246 → 1.236, Oct 1.312 → 1.322), which independently confirms it is
structural rather than an artifact of the missing months.

Caveat: this is raw and un-detrended over five years during which the level
changed substantially, so some of the spread is trend leakage. The detrended
ratio-to-moving-average in Step 3 is the real measurement.

### Decision

- [x] **Proceed to Step 3 (Phase 1 bake-off)** — with three constraints carried forward
- [ ] Proceed with caution
- [ ] Stop

**Constraints for Step 3/4, derived from the above:**

1. **Training window: 24–36 months, not the full 108.** The 2018→2024 structural
   shift and the 2021 outlier make older history actively misleading about
   current lumpiness and level.
2. **Trend handling is now the central problem, not seasonality.** A −36% YoY
   decline means any method that assumes level-stationarity will over-predict
   badly. Drift and linear-trend methods must be in the bake-off, not just
   seasonal-naive and decomposition.
3. **Seasonal-naive is likely to perform poorly here, which raises the bar in a
   useful way.** It repeats last year's month into a market running 36% below
   last year, so it will be systematically high. A trend-aware method should
   beat it comfortably — which means passing the FVA gate is weaker evidence
   than usual, and the absolute MASE figure matters more than the relative win.
   Consider also scoring against drift-adjusted naive as a second, harder
   baseline.

## 11b. Step 4 findings — the bake-off, and why Engine A was dropped

> **Run 2026-10-02.** Six methods scored against 106 rolling origins across
> 2017-11 → 2026-09. Results in
> `supabase/diagnostics/results/projection/step-3-verification/`.

### In one sentence

**A plain 12-month moving average beat every other method, including the
seasonal decomposition this whole design was built around — and even the
winner is too inaccurate to call a forecast.**

### How to read this section if you are not a statistician

The test was a guessing game against real history. Pretend it is January 2020
and guess February. Then pretend it is February and guess March. Repeat 106
times. Score each method on how far off it was.

**MASE** is the only score that matters here. It compares a method against the
dumbest possible rule — _"next month will equal the same month last year."_

- MASE **below 1** = better than that dumb rule
- MASE **1.0** = no better
- MASE **above 1** = worse than doing nothing clever

### The results, horizon 1 (invoiced)

| Method               | What it does                       | MASE      | Over-predicts |
| -------------------- | ---------------------------------- | --------- | ------------- |
| **ma12**             | average of the last 12 months      | **0.760** | 64% of months |
| ma3                  | average of the last 3 months       | 0.815     | 61%           |
| drift                | last value + recent trend          | 0.891     | 49%           |
| **decomposition**    | **Engine A — trend × seasonality** | **0.903** | 59%           |
| seasonal_naive       | same month last year               | 1.000     | 53%           |
| seasonal_naive_drift | same month last year, trend-scaled | 1.584     | 55%           |

`ma12` also wins at horizon 3 (0.811) and on **all three measures** — collected
0.698, orders 0.747, invoiced 0.760. That consistency is the strongest result
in the table; it is not a fluke of one series.

### Why seasonality lost

The detrended seasonal indices (V4) show one reliable month out of twelve:

| Month      | Index     | Std dev   | Verdict                                                                                                        |
| ---------- | --------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| **April**  | 0.621     | **0.094** | **Real.** Reliably ~38% below trend, every year                                                                |
| **March**  | 1.605     | **1.593** | **Not a pattern.** The spread is as large as the effect — a few enormous year-ends averaged with ordinary ones |
| All others | 0.81–1.15 | 0.26–0.49 | Noise                                                                                                          |

**October's apparent peak was trend leakage.** Raw index 1.312 → detrended
1.038. Phase 0's block 4 carried an explicit caveat that it was un-detrended;
this is why that caveat mattered.

One dependable seasonal month cannot pay for a decomposition model, and the
backtest confirms it directly.

### Two corrections to this document's own design

1. **`seasonal_naive_drift` was a bad idea.** §11 introduced it as "the honest,
   harder comparator" on the reasoning that a declining market makes plain
   seasonal-naive trivially beatable. It is in fact **the worst method tested**
   (MASE 1.584, over-predicting by 36%). The drift ratio is trailing, so after
   2021's RM116.9M spike it applied a ~1.58× multiplier to 2022 predictions
   exactly as revenue collapsed to RM67.9M. Drift amplifies error at turning
   points, which is where this series lives.
2. **The `is_publishable` flag in `v_sales_projection_backtest` is therefore
   too permissive**, and was redundant anyway: MASE is _defined_ as
   `mae ÷ mae_seasonal_naive`, so "MASE < 1" and "beats seasonal_naive" are the
   same test. Treat MASE < 1 as the gate and ignore `beats_naive_drift`.

### The finding that governs what gets built

**The winner's average miss is RM2.55M.** A typical month over the scored
period is RM6.79M, so that is a **37.6% average absolute error** — and against
2026's ~RM3.5M months, closer to **70%**.

An 80% interval on next month would span roughly RM1M–6M. That is honest and
almost useless for planning.

**Conclusion: monthly invoiced revenue is not predictable from its own history
at a useful accuracy.** Revenue arrives as a handful of large tenders, and
tenders do not follow a calendar. No amount of model sophistication fixes a
series that carries this little signal — which is precisely what the FVA gate
exists to discover before anything is built.

### Decision

- [x] **Engine A (seasonal decomposition) is dropped.** It lost to a moving
      average on both horizons and all three measures.
- [x] **History-only projection is not viable as a headline dashboard number.**
- [ ] ~~Proceed to Step 5 as originally scoped~~ — superseded, see §11c.

The four measurement views are kept. They are the evidence for this decision
and the harness for scoring any future method.

---

## 11c. Reframing — where the signal actually is

Steps 1–4 answered _"can we extrapolate invoiced revenue from its own past?"_
with a clear no. That was the right question to ask first and the cheapest to
answer, but it is not the question the business needs answered.

**The business question is "what will we invoice next month?" — and a large
part of that is already known, not guessed.** An invoice is almost always
preceded by a sales order. At any moment there is an open order book: work
committed by customers, with delivery dates attached, not yet invoiced.

A time-series model throws all of that away. It looks only at the output
history and ignores the input that causes it.

**The alternative is a bottom-up projection:**

> next month's invoicing ≈ (open orders scheduled to deliver next month)
> × (historical on-time conversion rate)
>
> - (orders booked _and_ invoiced within the same month)

This is the conversion-triangle idea from §3.2, but motivated by evidence
rather than elegance. Its advantages over anything in §11b:

- **It uses known commitments.** Most of the answer is observed fact, not
  extrapolation.
- **It needs no seasonality** — which is fortunate, since there isn't any.
- **It is explainable.** "We have RM X due for delivery next month and
  historically Y% of that invoices on time" is a sentence a sales director can
  challenge, correct, and act on. "The model says RM X" is not.
- **It degrades honestly.** Coverage is measurable: if only 40% of next month's
  invoicing is already booked, the figure says so.

**This is not yet proven.** Whether it works depends on one measurable fact:
how much of a month's invoicing was already sitting in the order book when the
month began. That is the Step 5 question, and
`supabase/diagnostics/sales_projection_orderbook_signal.sql` measures it before
anything is built.

The required links are already extracted:
`sap_invoice_lines.base_entry → sap_sales_orders.doc_entry` where
`base_type = 17`, and `sap_sales_orders.delivery_date` (SAP `DocDueDate`).

---

## 12. Changelog

| Date       | Change                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Written. Supersedes `hyrax-data-platform/docs/plans/10-forecasting-predictive-analytics-plan.md`, which was designed against an unbuilt star schema. Phase 0 diagnostic created; nothing else built. |

# Dashboard Design Research

Written 2026-10-16, while deciding where a revenue forecast belongs on Sales Reports.

**Why this file exists.** Several decisions on these pages had been argued from taste, and one of them — putting forecast rows inside the Invoiced Revenue tile — was argued from a *misreading* of a standard, shipped, and reverted the next day. This records the finding, the source, and **the decision it drove**, so the next person can disagree with evidence rather than re-run the argument.

Not a reading list. Every row below changed something.

---

## 1. This is a report, not a dashboard — and the distinction has rules

**Stephen Few,** [*Information Dashboard Design*](https://www.perceptualedge.com/articles/Whitepapers/Rich_Data_Poor_Data.pdf) · [dashboards vs reports in practice](https://chartio.com/blog/dashboards-vs-reports-how-theyre-the-same-how-theyre-different/)

> A dashboard *"should confine its display to a single screen, with no need for scrolling or switching between multiple screens"* — the whole value is simultaneity of vision. A **report** carries the detail a dashboard omits: a dashboard tells a CEO how company sales are progressing; the report lets the VP of Sales see every region and every rep.

**What it decided.** Sales Reports is ~10 sections and scrolls for several screens. By Few's definition it is **not a dashboard** — it is a report, and that is legitimate. We stopped treating its length as a defect.

It also named the actual defect: a report is allowed to be long, but it still needs a layer above it. We have none.

## 2. Overview first — the missing layer

**Shneiderman,** [*The Eyes Have It* (1996)](https://hci.stanford.edu/courses/cs448b/papers/shneiderman96eyes.pdf)

> *Overview first, zoom and filter, then details on demand.*

**What it decided.** The false choice was "one cluttered page" vs "separate pages that aren't a full report". The answer is neither — it's **layers on one artifact**. Sales Reports already has layer 2 (the stage sections) and layer 3 (drill-through to list pages via `to`/`filter`). It has **no layer 1**.

**Still open.** This is the largest unclosed gap on the page.

## 3. A scenario is a peer only when it shares the measure's dimensions

**IBCS** — [the standard](https://www.ibcs.com/IBCS/) · [SUCCESS formula](https://vizdj.com/success-formula-of-the-ibcs/) · [notation summary](https://www.ibcs.com/resource/top-and-bottom-5-of-international-business-communication-standards/) · [now an ISO standard](https://zebrabi.com/zbi_blog/ibcs-iso-standards/)

Semantic notation: **actual = solid fill, plan = outlined, forecast = hatched, previous year = grey** — so scenario type is readable without consulting a label. And the governing principle:

> *"Similar content should be visualized in a similar manner so that what looks the same also means the same, and **if content is not the same, it should not look the same**."*

Plus: *comparisons require consistent scaling.*

**What it decided — and the mistake it corrected.** IBCS was first used here to argue *for* putting forecast rows inside the Invoiced Revenue tile: actual, plan and forecast are scenarios of one measure, so they belong together. That reading omitted a condition.

**Scenarios are peers only when they share the measure's dimensions.** On Sales Reports, Actual and Budget both slice by salesperson and date. The forecast slices by date alone — `get_sales_projections` takes no owner parameter, and Phase D ruled per-rep projections permanently out of scope (the top three invoices are ~31% of a typical month; split across ten reps each series is one or two deals).

So with a rep selected the tile read: RM 4.2M actual, RM 8.1M budget, **RM 32.8M company forecast** — which also breaks the consistent-scaling rule. The rows were removed on 2026-10-16 and the rule written into `DASHBOARD-CONVENTIONS.md` §3.

**Not adopted:** IBCS fill notation itself (hatched forecast bars, outlined plan). It would mean changing `FanChartRenderer` and the bar renderers, which other sections share. We follow the *placement* half of the standard, not the *notation* half. Worth doing later.

## 4. Never blur actuals and forecasts

[Pedowitz — how dashboards visualize forecasts](https://www.pedowitzgroup.com/how-do-dashboards-visualize-forecasts) · [SumProduct — historical vs actual vs forecast](https://sumproduct.com/thought/historical-vs-actual-vs-forecast/)

> *"Clearly distinguishing confirmed actuals from projected figures, often using confidence bands... **Blurring this line (even unintentionally) leads to decisions based on projections treated as facts, where most messy executive debates originate.**"*

> Three distinct datasets, not one: historical (what happened), actual (current-year, may mix in projections), and forecast.

**What it decided.** Corroborated §3 above. It also justifies two things already built:

- The fan chart's **measured** 80% and 95% bands, verified at 77–82% coverage — not assumed intervals.
- `v_sales_projection_accuracy` keeping `recorded` (frozen snapshots) and `reconstructed` (rebuilt from the backtest) permanently apart, never averaged. The second flatters the model, because its settings were chosen knowing how those months turned out.

## 5. The shape of an executive report — and the piece we were missing

[Domo — executive dashboard practice](https://www.domo.com/learn/article/what-should-be-on-an-executive-dashboard)

> *Aim for 6–12 tiles: a mix of scorecards, one or two core time-series charts, a funnel or coverage view, **a variance bridge**, and a small scenario area.*

**What it decided.** Measured against that prescription, Sales Reports had four of five:

| Prescribed | We had |
|---|---|
| Scorecards | Sales KPIs — 8 tiles ✅ |
| 1–2 core time-series | Order-to-Cash Overview ✅ |
| Funnel / coverage view | Pipeline → Order → Invoice → Payment ✅ |
| **Variance bridge** | ❌ |
| Small scenario area | Projections section ✅ |

The **"Where the Budget Gap Came From"** chart was added 2026-10-16 to close it. Budget → per-rep variance → Invoiced Revenue. Zero new SQL — `invoiceBudgetScorecardData` was already on the page for the Rep Funnel Scorecard.

Note also *"a small scenario area"* — the forecast gets its own region by prescription, which is where the Projections section already sits.

## 6. Column grouping: forecast sits apart even inside a table

[Farseer — monthly financial report](https://www.farseer.com/blog/monthly-financial-report/) · [PivotXL — budget vs actuals for FP&A](https://pivotxl.com/budget-vs-actuals-reporting-variance-analysis-excel-fpa/)

The standard management pack is not one flat row of columns. It groups by **scope**:

```
                Current month          Year to date           Full year
             Act | Bud | Var %      Act | Bud | Var %      Bud | Forecast | Var
```

**What it decided.** Independent corroboration of §3 from accounting practice rather than visualisation theory: even where actual and forecast appear in one table, **the forecast lives in the full-year column group**, never inside the current-month group. Different scope, different block.

## 7. How many KPIs

[ClearPoint — KPI dashboard practices](https://www.clearpointstrategy.com/blog/kpi-dashboard-best-practices) · [Yellowfin — dashboard design principles](https://www.yellowfinbi.com/blog/key-dashboard-design-principles-analytics-best-practice)

> 5–9 KPIs per view; 3–5 primary with 8–12 available on drill-down. One study found 78% of users preferred fewer than 10 high-level KPIs on the main view.

**What it decided.** Two things, one of them a correction.

It drove the Projections section from **7 tiles to 4** on 2026-10-15 (`DASHBOARD-CONVENTIONS.md` §4a's own test — does this tile answer a *new* question?).

But it also corrected an overstatement: the page's 12 top-level tiles sit at the **top of the recommended range, not past it**. The problem is not the count. It is that all 12 carry equal weight, with no hero and no layering — which is §2, not §7.

---

## What this page still doesn't do

Named so the next restructure argues from evidence.

1. **No layer-1 overview.** §2. The single largest gap.
2. **No page hero.** `DASHBOARD-CONVENTIONS.md` §4 defines one — "the page's one designated headline metric", fixed blue, always filled. Sales Reports has none; `blueCardFill` appears nowhere in its three configs. Finance Reports has one ("Revenue Invoiced").
3. **IBCS notation is not implemented** — only its placement rules. §3.
4. **Three concentration tiles ask one question.** Customer, Product and Product Group Concentration are three angles on *how concentrated are we?* — §4a says fold. Not done, because they were deliberately built and the fold deserves its own conversation.
5. **Forecast Value Added is measured but unpublished.** We know the blend misses ~30% at one month against seasonal-naive's 49% (positive), and that seasonal-naive **beats** it at h=6 and h=12 (negative). The dashboard implies uniform quality across horizons. Publishing FVA per horizon is the honest fix.

---

## A note on using these sources

Most of the links above are vendor blogs and practitioner write-ups, not peer-reviewed work. The two exceptions are Shneiderman (1996, a cited paper) and IBCS (a published standard). Where a vendor source agreed with a standard we treated it as corroboration; where it stood alone we treated it as a prompt to check our own data, not as proof.

The numbers that actually bind on this project — band coverage at 77–82%, the ~30% single-month miss, seasonal-naive at 49%, the top three invoices at 31.2% of a month — are all **measured from Hyrax data**, in `docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md` §11. Nothing here overrides those.

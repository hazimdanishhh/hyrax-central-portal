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

## 8. Navigating a long report: jump links, yes — in the nav bar, no

**Nielsen Norman Group,** [*Anchors OK? Re-Assessing In-Page Links*](https://www.nngroup.com/articles/in-page-links/)

The most authoritative source in this file on the question, and it is unusually specific.

> In-page links "do not meet users' mental model for a link" — people expect a link to take them to a new page. They are "only helpful if the content on a page is lengthy", and the benefit "increases as screen size decreases".

Four concrete rules:

1. **Label the list.** "On this page", not a bare row of links.
2. **Do not put them in the sticky navigation bar.** *"Putting links in an area commonly used for navigation makes this problem worse."* A sticky table of contents **beside** the content is fine on large screens; the global nav bar is not.
3. **Show where you are.** If the list is sticky it must mark the current section, you-are-here style.
4. **Do not let the sticky header cover the heading you jumped to.** This is the classic anchor bug; `scroll-margin-top` is the fix.

And one that cuts the other way: if a page holds *4 or 5 distinct topics and users read only a few*, NN/G says **split it into separate pages** rather than adding jump links.

**What it decided.** Sales Reports has **nine** `.pdfOverviewSection` blocks and scrolls for several screens — comfortably past "lengthy". A section index is justified. But it goes in **its own rail or an "On this page" control at the top of the content**, never into the page's existing header bar beside the filters. The split-into-pages escape hatch does not apply: see §9.

## 9. Tabs and accordions hide what this page needs combined

**NN/G,** [*Accordions on Desktop*](https://www.nngroup.com/articles/accordions-on-desktop/) · [*Accordions for Complex Content*](https://www.nngroup.com/articles/accordions-complex-content/) · [*Accordions on Mobile*](https://www.nngroup.com/articles/mobile-accordions/) · [*Tabs vs. Accordions*](https://www.nngroup.com/videos/tabs-vs-accordions/)

> Accordions are progressive disclosure: a heading gives the overview, the panel is hidden by default. But hidden content is less discoverable, and where users need many sections, *"on the desktop it is easier to simply scroll the page than to decide on which topics to click on."*

> Use them "on content-heavy pages where users **don't need to combine information across sections**." Tabs suit a few long sections; accordions suit many short ones. Both are avoided where "a seamless reading experience and uninterrupted narrative flow are prioritized".

Corroborated from the BI side: [Preset](https://preset.io/blog/bi-dashboard-best-practices/) recommends tabs to avoid overloading one view, [Fresh Consulting](https://www.freshconsulting.com/insights/blog/uiux-principle-21-when-and-when-not-to-use-tabs/) offers the test *"if you would want readers to access each section separately when printed, tabs are a logical choice"*, and [Graphed](https://www.graphed.com/blog/how-to-make-power-bi-page-scrollable) defends top-to-bottom scrolling for a KPI→detail narrative. [One essay](https://medium.com/@pavithraa/why-it-is-okay-to-scroll-d1a4a3d0e589) notes tabs force key metrics to be repeated on every tab.

> **Superseded 2026-10-22/23 — see §11.** Sales Reports moved to tabs. The reasoning below is kept as the record of why it was first rejected.

**What it decided — no tabs, and the reason is specific to this page.** The combine-across-sections test fails outright here:

- the variance bridge in Order-to-Cash Overview explains the Invoiced Revenue tile six sections up;
- the funnel explains the four stage-detail sections below it;
- Projections' reliability tile is read against the forecast tile beside it.

A monthly review argues *across* these, not within one. Fresh Consulting's printing test points the same way — see §10, where it turns out to be the wrong test for this codebase.

§1's finding still governs: by Few's definition this is a **report**, not a dashboard, and a report is allowed to be long. The defect was never its length.

## 10. The export already decides this, and it has not been consulted

Not a published source — a finding from the code, recorded here because it outranks every opinion above.

`src/components/exportActions/ExportActions.jsx` **already treats the section as the unit of export.** It does not screenshot the page; it iterates `targetRef.current.querySelectorAll(".pdfOverviewSection")`, captures each one with `html2canvas`, and paginates between them.

Two consequences nobody has acted on:

**Section-selective export is nearly free.** The list of sections already exists at export time. What is missing is only that the sections have no *names* — the DOM nodes are anonymous. Give them identity and the same list drives the index, the anchors and a set of export checkboxes.

**Tabs and collapsed accordions would BREAK the existing export.** React unmounts inactive tab panels, so `querySelectorAll` would find only the visible ones and silently emit a partial PDF — the worst failure mode, because it looks like a complete document. A CSS-collapsed panel is no better: `display: none` gives `html2canvas` a zero-height box, and `(canvas.height * width) / canvas.width` then feeds `NaN` into `pdf.addImage`.

Either is solvable by rendering every section off-screen during export, but that is real work on a fragile path, and it is a cost that the scroll-plus-index option simply does not have.

**What it decided.** Keep one scrolling page. Add identity to the sections, and spend the effort on export selection rather than on hiding things.

## 11. The final structure — tabs, and twelve rules (2026-10-22/23)

**Why tabs after all (supersedes §9).** The user asked for the report to be split for meetings that walk one funnel stage at a time, and two of §9's objections no longer held. (1) The cross-section reading §9 protected is now built *into* each tab instead of across the page: every stage tab carries its own KPIs, trend, open position and breakdown, and Summary carries the cross-stage story (funnel tiles, FY progress, the bridge, open position) as layer 1 — which also closes §2's gap. (2) §10's export problem dissolved: each tab exports itself (`ExportActions` on the active tab), which is what a meeting pack per stage wants. NN/G's own test — users reading "only a few" of 4–5 distinct topics — fits a stage-by-stage meeting.

**Why the twelve rules (`DASHBOARD-CONVENTIONS.md` §8).** Between 2026-10-22 and 10-23 the tab contents were reorganised several times, each time from a code review. The fix was to write the standard first and derive the layout from it. The sources, and what each decided:

| Source | Finding | Rule it drove |
| --- | --- | --- |
| [IBCS — top and bottom 5](https://www.ibcs.com/resource/top-and-bottom-5-of-international-business-communication-standards/), [scenario notation (v1.1 PDF)](https://www.ibcs.com/wp-content/uploads/2021/02/IBCSv1-1_p125-131.pdf), [ISO 24896](https://zebrabi.com/zbi_blog/ibcs-iso-standards/) | Actual solid, plan outlined, forecast hatched, previous year grey — "not different colors, but different patterns"; red/green only for variances; time vs structure decides the chart; use pies with caution; consistent titles | R2, R4, R5, R6, R7 |
| [Shneiderman 1996](https://webspace.science.uu.nl/~telea001/uploads/VACourse/Shneiderman96.pdf), [Minto pyramid](https://managementconsulted.com/pyramid-principle/) | Overview first; answer first, then support, then data | R1 (Summary first, KPIs first on every tab; an AI Meeting Brief at the top is built but parked) |
| [Kimball / fact table types](https://en.wikipedia.org/wiki/Fact_table), [Microsoft — dimensional modelling](https://learn.microsoft.com/en-ca/%20fabric/data-warehouse/dimensional-modeling-fact-tables) | Balances are snapshots, semi-additive: summable across entities, never across time | R3 — open balances are Today, never "raised in the period", no previous-period figure |
| Management-pack column practice ([Phocas](https://docs.phocassoftware.com/budgets-and-forecasts/getting-started/overview-of-key-terms-and-concepts/overview-of-budgets-versus-forecasts), [Fathom](https://fathomhq.com/blog/new-enhanced-actuals-vs-budget-reporting)) | Month / YTD / full-year outlook vs budget | R8 (FY to Date, Monthly Invoicing Needed, projected FY, cumulative chart) |
| [AR KPIs — HighRadius](https://www.highradius.com/resources/Blog/guide-to-accounts-receivable-reporting-and-analytics/), [Ramp](https://ramp.com/blog/accounts-payable/accounts-receivable-kpis) | Standard AR set is aging buckets + % overdue + a speed measure (DSO); CEI needs opening balances | Collection Rate retired; Overdue, Overdue by Age, DSO (Finance's formula, shared via `ar_dso`) |
| [Book-to-bill — AccountingTools](https://www.accountingtools.com/articles/book-to-bill-ratio.html), [IPC method](https://www.electronics.org/news-release/north-american-ems-industry-101-percent-january) | Ratio > 1 grows the backlog; IPC reads it over 3 months because one month of orders is too volatile | Order-to-Invoice Ratio + its last-3-months figure (`sales_run_rate`) |
| [Pipeline coverage — Coefficient](https://coefficient.io/pipeline-coverage), [RevOps metrics](https://resources.rework.com/vi/guides/revops-playbooks/revops-metrics-coverage-accuracy) | Coverage = open pipeline ÷ quota remaining, ~3× typical; win rate on a consistent stage definition | Pipeline Coverage (unweighted, informational), Pipeline Generated |
| [Leading vs lagging — Basedash](https://www.basedash.com/blog/leading-vs-lagging-indicators-how-to-build-dashboards-that-warn-you-early) | Pair leading inputs with lagging outcomes | R12 |
| [Pie / donut guidance — Maersk](https://designsystem.maersk.com/guidelines/data-visualisation/chart-types/pie-donut-chart/), [UNHCR](https://dataviz.unhcr.org/chart_gallery/part_to_a_whole.html) | Pies for 2–5 parts of a whole, label directly | Export / Local stays a donut, labelled with %, total in the centre |
| [Microsoft — dashboard design tips](https://learn.microsoft.com/en-gb/power-BI/create-reports/service-dashboards-design-tips), [AlphaBOLD — Power BI design](https://www.alphabold.com/top-power-bi-dashboard-design-tips-for-clear-and-impactful-visuals/), [Shneiderman 1996](https://webspace.science.uu.nl/~telea001/uploads/VACourse/Shneiderman96.pdf) | Keep the view clean and only what matters stands out; place filters consistently; cut any element that wouldn't change a decision; detail belongs a layer down ("details on demand") | R13 (2026-10-23): a filter must serve the audience's decisions, be honoured by every figure, not duplicate a breakdown chart, and not be a work-queue attribute (those are List filters). Leads Overview dropped Client / SAP Customer / Lead Source / stage / on-hold / cancelled / product filters on this basis |

**What it did not adopt:** IBCS hatching for forecasts in bar charts (the fan chart already separates actual from forecast), and IBCS's black-and-white palette (the app's measure colours stay; plans and last year follow the pattern half of the standard).

---

## What this page still doesn't do

Named so the next restructure argues from evidence. Updated 2026-10-23.

1. ~~No layer-1 overview.~~ **Closed** by the Summary tab, §11.
1b. **Sections have no names in code** (§10) — less pressing now each tab has 4–6 sections, but still the prerequisite for a section index or section-selective export.
2. **No page hero.** Sales' headline tiles all carry a verdict colour (§4: a dynamic tile surrenders hero blue), so none can be the fixed hero. Left as is on purpose.
3. **IBCS notation is partly implemented**: plans are dashed grey lines and variances have a real bridge (`BridgeChartRenderer`); forecast hatching in bar charts is not done.
4. ~~Three concentration tiles ask one question.~~ Now two (customer, product — the group is a sub-metric of product).
5. **Forecast Value Added is measured but unpublished.** We know the blend misses ~30% at one month against seasonal-naive's 49% (positive), and that seasonal-naive **beats** it at h=6 and h=12 (negative). The dashboard implies uniform quality across horizons. Publishing FVA per horizon is the honest fix.
6. **Definitions travel only in tooltips**, which a shared screen and the PDF don't show. A per-tab definitions block in the export is the fix.

---

## A note on using these sources

Most of the links above are vendor blogs and practitioner write-ups, not peer-reviewed work. The two exceptions are Shneiderman (1996, a cited paper) and IBCS (a published standard); the Nielsen Norman Group articles in §§8–9 sit between the two — practitioner research from usability testing, not peer review, and the in-page-links piece is some years old. Where a vendor source agreed with a standard we treated it as corroboration; where it stood alone we treated it as a prompt to check our own data, not as proof.

The numbers that actually bind on this project — band coverage at 77–82%, the ~30% single-month miss, seasonal-naive at 49%, the top three invoices at 31.2% of a month — are all **measured from Hyrax data**, in `docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md` §11. Nothing here overrides those.

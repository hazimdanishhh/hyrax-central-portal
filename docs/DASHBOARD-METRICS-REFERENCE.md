# Dashboard Metrics Reference (as-built)

This is the as-built counterpart to `DASHBOARD-IA-STRATEGY.md` (naming/tier conventions, current-state audit) and `DEPARTMENT-DASHBOARD-BLUEPRINT.md` (design intent/roadmap): what each of the four existing dashboards actually computes and shows today — every KPI, every chart, exactly how each is calculated, which tables feed it, and how each page is laid out. It's groundwork, not a redesign — use it to decide what to add/cut/reshape per department for management, executive, and staff use, ahead of the eventual cross-department Executive Summary (Tier 4, doesn't exist yet).

## 1. Inventory

| Dashboard            | Route                  | Tier                     | Audience / cadence                       | RPC                           | Page component          |
| -------------------- | ---------------------- | ------------------------ | ---------------------------------------- | ----------------------------- | ----------------------- |
| Sales Leads Overview | `sales/leads/overview` | 2 (entity/coaching)      | Sales reps + manager, daily              | `get_sales_leads_dashboard`   | `LeadsOverview.jsx`     |
| Sales Reports        | `sales/reports`        | 3 (department synthesis) | Sales Manager + execs, monthly/quarterly | `get_sales_reports_dashboard` | `Reports.jsx`           |
| Finance Reports      | `finance/reports`      | 3                        | Finance + execs                          | `get_finance_dashboard`       | `FinancialReports.jsx`  |
| Operations Reports   | `operations/reports`   | 3                        | Ops Manager + execs                      | `get_operations_dashboard`    | `OperationsReports.jsx` |

Tier 4 (Executive Summary, cross-department) does not exist yet.

## 2. Cross-cutting conventions

- **RPC shape**: every dashboard RPC returns one `json_build_object` — a `kpis` object plus named chart-array keys. Base CTEs (`base_invoices`, `base_orders`, `base_deliveries`, `base_leads`, …) apply the cancellation guard (`is_cancelled = 'N'`) once, up front, and everything downstream reads from them.
- **Deploy mechanism**: RPCs are plain `.sql` files under `supabase/sql_editor/`, hand-pasted into the Supabase Studio SQL editor — no CLI/migrations wired up. Any RPC edit is a manual deploy step.
- **Point-in-time vs. period-bound**: every dashboard mixes both. "As of today" snapshot metrics (AR aging, overdue customers, open backlog, stock position, active pipeline) deliberately ignore the date-range filter; period-bound metrics (revenue, collections, fill rate, on-time %) respect it. Each RPC comments this distinction explicitly at the field level — it's a recurring point of confusion worth flagging in any redesign.
- **Previous-period delta pattern**: Finance and Sales Leads Overview both compute a same-length immediately-preceding window (`v_prev_start_date`/`v_prev_end_date`) server-side for 1-2 fields, then a client-side `calcDelta(current, previous)` helper (in each page's `overviewConfig.js`) turns that into "↑/↓ X% vs last period" with `TrendUpIcon`/`TrendDownIcon`. Sales Reports and Operations Reports do **not** have this yet — no period-over-period trend indicator on either.
- **Proration formula**: day-overlap proration of a monthly target/budget against an arbitrary date range appears twice, deliberately mirrored — `sales_targets` (Leads Overview's `scorecardData`, and Sales Reports' `pipeline_target_math`) and `sales_budgets` (Sales Reports' `budget_math`). Same formula both places so the two never silently drift.
- **Gross-profit sanitization guard**: SAP's `GrosProfit` field has a known master-data defect (legitimate GP/revenue ratios top out ~2.7x; defective rows run 900-1000x+). Both Finance (`salesRepRevenueData`) and Sales Reports (`grossProfitByRepData`) null out GP when `abs(gross_profit) > abs(total_amount_myr) * 5`, without dropping the row's revenue/count.
- **Employee ↔ SAP rep bridge**: SAP-keyed rep metrics (Sales Reports' Forecast 2, Finance's Salesperson Health) are computed on `sales_rep_code` first, then joined out through `sap_sales_persons.employee_id = employees.employee_id` **only** for display name/avatar — never for the attribution math. A rep with a blank/mismatched EmpID shows as "Unknown" and silently drops out of the name resolution (though not out of the totals).
- **Freshness banner**: `*_dashboard_rpc`-adjacent metadata services (`salesReportsMetadataService`, `financeMetadataService`, `operationsMetadataService`) each query `sap_pipeline_state` for a fixed list of relevant pipeline names, take the **oldest** `last_run_at` as "asOf", and flag `hasFailedPipeline` if any watched pipeline's last run errored. Leads Overview has **no** freshness banner at all. Operations' watched pipeline list (`sap_sales_orders`, `sap_deliveries`, `sap_items`) notably excludes `sap_invoices`, even though two of its own cycle-time KPIs depend on invoice data.
- **AI Executive Briefing** (`AISummary` + `GenerateAiButton`, Gemini-backed): **live** on Leads Overview (`type="leads"`); present in code but **commented out/disabled** on Finance Reports (`type="finance"`); **absent entirely** from Sales Reports and Operations Reports.
- **Export**: `ExportActions` (PDF via `jspdf`) wraps the full KPI+chart content on Sales Reports, Finance Reports, and Operations Reports via a `dashboardRef`/`pdfOverviewSection` convention. Leads Overview's export path is less direct — `ExportActions`/`ExportData`/`ExportFullReport` are imported but not directly rendered; export is driven through `SearchFilterBar`'s `enableExport` prop instead.
- **Shared components**: `OverviewCards` (KPI tiles, `metrics[]` sub-rows, optional drill-through `to`), `ChartCard` + renderers (`BarChartRenderer`, `HorizontalBarChartRenderer`, `HorizontalMultiBarRenderer`, `LineChartRenderer`, `PieChartRenderer`, …) from `components/chartCard/`, and `ScorecardList`/`LeadsScoreCard` (per-rep quota progress bar) — reused as-is by Sales Reports for its Invoice Budget scorecard, just with remapped field names.

## 3. Data source map

| Table                                                      | Used by                                                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sales_leads`, `sales_leads_stage_history`                 | Leads Overview, Sales Reports                                                                                                                              |
| `sales_targets` (Forecast 1)                               | Leads Overview (`scorecardData`, separate `get_sales_targets_prorated` RPC), Sales Reports (`pipeline_target_math`)                                        |
| `sales_budgets` (Forecast 2)                               | Sales Reports only                                                                                                                                         |
| `sales_leads_lose_reasons`, `lead_source_types`, `clients` | Leads Overview (+ `lead_source_types`/`clients` also in Sales Reports' composition charts)                                                                 |
| `employees`, `profiles`                                    | Leads Overview, Sales Reports (display-only join for SAP-keyed rows)                                                                                       |
| `sap_sales_persons`                                        | Sales Reports, Finance                                                                                                                                     |
| `sap_sales_orders`                                         | Sales Reports (order book), Finance (`salesRepRevenueData` — the only RPC output derived from orders, not invoices), Operations (backlog, all of it)       |
| `sap_sales_order_lines`                                    | Operations only (fill rate, undelivered units/items)                                                                                                       |
| `sap_invoices`                                             | Sales Reports, Finance (core), Operations (`full_chain` cycle-time only)                                                                                   |
| `sap_invoice_lines`                                        | Operations only (order→delivery→invoice chain)                                                                                                             |
| `sap_deliveries`, `sap_delivery_lines`                     | Operations only                                                                                                                                            |
| `sap_items`                                                | Operations only (stock position, undelivered items)                                                                                                        |
| `sap_payments`, `sap_payment_applications`                 | Finance only                                                                                                                                               |
| `sap_customers`                                            | Finance (customer filter search) — invoices/payments already carry denormalized `customer_code`/`customer_name`, so no join needed for the KPIs themselves |
| `sap_pipeline_state`                                       | Freshness banners on Sales Reports, Finance, Operations                                                                                                    |
| `sales_orders`, `sales_attainment_snapshots`               | **Dormant** — schema exists, zero application code reads/writes either today                                                                               |

---

## 4. Sales Leads Overview (`LeadsOverview.jsx`, RPC `get_sales_leads_dashboard`)

**Core question:** is the pipeline healthy today, and how is each rep tracking against quota?

### KPI formulas (all from the `kpis` object unless noted)

| Field                                              | Meaning                                           | Formula                                                                                   | Period-bound?                                    |
| -------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `totalLeadsCreated`                                | Leads created in period                           | `count(*)` where `created_at` in range                                                    | Yes                                              |
| `pipelineGenerated`                                | $ of leads created in period                      | `sum(expected_revenue)` where `created_at` in range                                       | Yes                                              |
| `wonLeads` / `wonRevenue`                          | Deals won / their actual $                        | `count(*)` / `sum(actual_revenue)` where `stage='WON'` and `closed_date` in range         | Yes                                              |
| `avgDealSize`                                      | Avg won deal size                                 | `avg(actual_revenue)` where WON, closed in range                                          | Yes                                              |
| `lostLeads` / `lostRevenue`                        | Lost or cancelled, and forfeited $                | `count`/`sum(expected_revenue)` where (`stage='LOST'` or `is_cancelled`), closed in range | Yes                                              |
| `winRate`                                          | % of closed decisions won                         | `WON / (WON+LOST)` (cancelled excluded from denominator)                                  | Yes                                              |
| `activeLeads` / `activePipelineValue`              | Live open pipeline count/$                        | `count`/`sum(expected_revenue)` where not WON/LOST/cancelled                              | **No** — real-time snapshot                      |
| `weightedPipelineValue`                            | Probability-weighted forecast                     | `sum(expected_revenue * close_probability/100)`, active leads                             | **No**                                           |
| `avgDaysToClose`                                   | Sales cycle length, won deals                     | `avg(closed_date − created_at)` in days, WON in range                                     | Yes                                              |
| `forecastVariance`                                 | Actual vs. forecast on won deals                  | `sum(actual_revenue) − sum(expected_revenue)`, WON in range                               | Yes                                              |
| `expectedRevenueOfWonDeals`                        | Forecast value of deals that won                  | `sum(expected_revenue)`, WON in range                                                     | Yes (returned by RPC, **not shown on the page**) |
| `avgGeneratedDealSize` / `avgGeneratedProbability` | Avg size / probability of leads created in period | `avg(expected_revenue)` / `avg(close_probability)`, created in range                      | Yes                                              |
| `fastTrackDeals`                                   | Created AND won inside the same period            | `count(*)` where WON, both `created_at` and `closed_date` in range                        | Yes                                              |
| `negotiationPipeline` / `onHoldPipeline`           | $ currently in Negotiation / paused               | `sum(expected_revenue)` filtered to that state                                            | **No**                                           |
| `avgLostDealSize` / `avgLostCycle`                 | Avg size / cycle length of lost deals             | same pattern as won equivalents, `stage='LOST'`                                           | Yes                                              |
| `cancelledLeads`                                   | Cancelled, closed in period                       | `count(*)` where `is_cancelled`, closed in range                                          | Yes                                              |
| `prevPipelineGenerated` / `prevWonRevenue`         | Prior equal-length period's figures               | same formulas, shifted window; `null` (not `0`) when no date filter is set                | Prior-period                                     |

**Not shown on the page today**: `expectedRevenueOfWonDeals`, `prevPipelineGenerated` — both computed, neither displayed.

### Chart-array fields

| Array                                                                 | Grouping                                                    | Value(s)                                                                                          | Date-filter logic                                                                                                                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stageData`                                                           | `stage`                                                     | count, total_value (`actual_revenue` if WON else `expected_revenue`)                              | OR of created-in-range / closed-in-range (carryover leads included)                                                                                                                                    |
| `probabilityHealthData`                                               | 4 probability buckets (0-25/26-50/51-75/76-100)             | count, total expected_revenue                                                                     | **No** — active pipeline only, real-time                                                                                                                                                               |
| `lossReasonData`                                                      | lose reason (left-joined, unattributed → "No Reason Given") | count, total lost expected_revenue                                                                | OR logic, `stage='LOST'` only (excludes cancelled)                                                                                                                                                     |
| `trendData`                                                           | month (`sales_leads_stage_history.changed_at`)              | leads_created, pipeline_generated, deals_won, revenue_won, deals_lost, revenue_lost               | Filtered on history `changed_at`, not lead `created_at`/`closed_date`; `revenue_won` uses **current** `actual_revenue`, others use the **historical** `expected_revenue` snapshot at that stage change |
| `productTypeData` / `sourceData` / `topClientsData` / `leadOwnerData` | product_type / lead_source / client / rep                   | active_in_period, pipeline_generated, won_expected, won_actual, lost_revenue                      | "was this lead alive during the period" filter (not-yet-closed OR closed-after-start, created-before-end) — distinct from the strict windows used in `kpis`                                            |
| `scorecardData`                                                       | rep (`lead_owner_id`)                                       | actual_revenue (WON, in period), target_revenue (prorated `sales_targets`), attainment_percentage | Target proration uses **no** owner filter — if the page is filtered to one rep, other reps with a target row can still appear (0 actual)                                                               |

### KPI cards (page)

| Card               | Value                 | Sub-metrics                                                                                                                                                                                                          |
| ------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active Pipeline    | `activePipelineValue` | Active Leads, Weighted Pipeline, In Negotiation, On-Hold Cash — all real-time, explicitly tooltipped "Not based on filters"                                                                                          |
| Pipeline Generated | `pipelineGenerated`   | Leads Created, Avg Deal Size, Avg Probability, Fast Track Deals                                                                                                                                                      |
| Revenue Attainment | `wonRevenue`          | Prev. Period Delta (client `calcDelta` vs `prevWonRevenue`), Quota Attainment (client-computed `wonRevenue/targetRevenue`, target from a **separate** `get_sales_targets_prorated` RPC), Forecast Variance, Win Rate |
| Lost Revenue       | `lostRevenue`         | Total Lost Deals, Avg Lost Deal Size, Avg Lost Cycle, Cancelled/Junk                                                                                                                                                 |

All four cards drill through to `../list` with a stage filter where relevant (`?stage=WON` / `?stage=LOST`).

### Charts (page)

Lead Stages (count by stage) · Active Pipeline Health (by probability bucket, $) · Revenue Lost (by reason) · Pipeline Activity Over Time (volume: created/won/lost) · Revenue Trend Over Time ($: pipeline/won/lost) · **Executive Leaderboards** — 4 charts (Product / Owner / Source / Clients) behind a 3-way lens toggle (Productivity: generated vs won; Accuracy: expected vs actual won; Execution: won vs lost), each chart self-hides when its own dimension is already filtered.

### Layout

AI Summary → Tier 1 "Sales KPIs" (4 cards) → Sales Performance Scorecard (conditional on data) → Tier 2 "Pipeline Health & Funnel" (3-col: stages/probability/loss-reason) → Tier 3 "Historical Diagnostics" (2-col: the two trend lines) → "Executive Leaderboards" section (lens toggle + 4 charts).

### Notable gaps/caveats

- No freshness/last-synced banner anywhere on this page.
- `scorecardData`'s target proration ignores the owner filter — can leak other reps into a single-rep view.
- Several imported color constants (`LEAD_STAGE_COLORS`, `LEAD_TREND_COLORS`, `YELLOW_COLOR`, `PRODUCT_TYPE_COLORS`) appear unused in the JSX itself.

---

## 5. Sales Reports (`Reports.jsx`, RPC `get_sales_reports_dashboard`)

**Core question:** is the department hitting both its pipeline and invoiced-revenue forecasts, and where is growth/risk concentrated? Surfaces **both** forecasts side by side, deliberately never blended (per `DASHBOARD-IA-STRATEGY.md` §7).

### KPI formulas

| Field                                         | Meaning                                                                        | Formula                                                                                | Source                      |
| --------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------- |
| `pipelineTargetRevenue`                       | Prorated Forecast-1 target, dept-wide                                          | Same day-overlap proration as Leads Overview's `scorecardData`, summed across all reps | `sales_targets`             |
| `pipelineWonRevenue`                          | WON actual revenue, CRM                                                        | `sum(actual_revenue)` where WON, closed in range                                       | `sales_leads`               |
| `pipelineAttainmentPct`                       | Forecast 1 attainment                                                          | `won / target * 100`                                                                   | derived                     |
| `orderBookValue`                              | SAP orders booked in period                                                    | `sum(total_amount_myr)`, `is_cancelled='N'`, `order_date` in range                     | `sap_sales_orders`          |
| `winRatePct`, `avgDealSize`, `avgDaysToClose` | Same definitions as Leads Overview's `kpis`, recomputed here from `base_leads` | —                                                                                      | `sales_leads`               |
| `quoteToWinConversionPct`                     | Quoted leads that won                                                          | `count(WON and quotation_url is not null) / count(quotation_url is not null)`          | `sales_leads.quotation_url` |
| `medianDaysToWin`                             | Median cycle time for quoted-and-won deals                                     | `percentile_cont(0.5)` of `closed_date − created_at`                                   | `sales_leads`               |

### `invoiceBudgetScorecardData` (Forecast 2, per-rep) — the budget vs. actual invoice comparison

Per `sales_rep_code`: `invoiced_revenue` (`sum(sap_invoices.total_amount_myr)`, `is_cancelled='N'`, in period), `budget_revenue` (prorated `sales_budgets.budget_revenue`, same day-overlap formula as Forecast 1), `attainment_percentage` (`invoiced/budget*100`, 0 if no budget). `employee_uuid`/`rep_name`/`avatar_url` joined in for display only (`sap_sales_persons.employee_id = employees.employee_id`), never for the math. `full outer join` so a rep with invoices-but-no-budget, or budget-but-no-invoices, still appears.

### Other chart-array fields

| Array                                               | Grouping                       | Value(s)                                                                                                                       |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `orderBookData`                                     | rep                            | SAP order value, top 15                                                                                                        |
| `realizedVsPipelineData`                            | month                          | `pipeline_revenue_myr` (CRM WON), `realized_revenue_myr` (SAP invoiced) — two systems side by side, `full outer join` on month |
| `grossProfitByRepData`                              | rep                            | `revenue_myr`, `gross_profit_myr` (GP-sanitization guard applied), top 15                                                      |
| `productTypeData` / `sourceData` / `topClientsData` | product / lead source / client | WON revenue (CRM), top 10 for clients                                                                                          |

### KPI cards (page) — "Sales KPIs", Tier 1

| Card                                   | Value                                                                                                                                                  | Sub-metrics                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Pipeline Attainment (Forecast 1)       | `pipelineAttainmentPct`%                                                                                                                               | Target, Won (CRM)                 |
| Invoice Budget Attainment (Forecast 2) | `budgetAttainmentPct`% — **computed client-side** by summing `invoiceBudgetScorecardData` rows (`totalInvoiced`/`totalBudget`), not pulled from `kpis` | Invoiced (SAP), Budget            |
| Order Book                             | `orderBookValue`                                                                                                                                       | Win Rate, Avg Deal Size           |
| Sales Cycle                            | `avgDaysToClose`d                                                                                                                                      | Quote → Win %, Median Days to Win |

### Charts (page)

Realized (SAP) vs Pipeline (CRM) Revenue — line chart, explicitly "not blended" · Order Book by Rep · Gross Profit by Rep (revenue vs GP bars) · Product-Type Mix · Lead-Source ROI · Top Clients.

### Layout

Tier 1 "Sales KPIs" (4 cards) → Tier 2 "Invoice Budget Scorecard" (per-rep `ScorecardList`, reusing the Leads-Overview component with remapped field names) + Realized-vs-Pipeline chart → Tier 3 "Order Book & Profitability" (2 charts) → Tier 4 "Pipeline Composition" (3 charts).

### Notable gaps/caveats

- No AI Summary, no period-over-period delta anywhere on this page (both present elsewhere in the app).
- A stray `console.log(dashboard)` debug line is still present in the component.
- `sales_budgets.budget_gross_profit` was proposed in the blueprint doc but never actually added to the real migration — only `budget_revenue` exists, so there's no GP-based budget view possible today.
- `sales_attainment_snapshots` (for locking period-end attainment, audit/comp purposes) exists in schema but is unused — both this page's and Leads Overview's attainment figures are always live-recomputed, so they can shift retroactively if invoices get cancelled/corrected after the fact.

---

## 6. Finance Reports (`FinancialReports.jsx`, RPC `get_finance_dashboard`)

**Caveat stated directly in the codebase**: Finance today is an AR subledger with a "Finance" label on it — every KPI is revenue/collections/AR, never a true P&L/margin figure, because there's no GL/Chart-of-Accounts extraction from SAP.

### KPI formulas

| Field                                              | Meaning                         | Formula                                                                                                                                                                       | Period-bound?                                        |
| -------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `periodInvoicedRevenue` / `periodInvoiceCount`     | Invoiced in period              | `sum`/`count` from `sap_invoices`, `invoice_date` in range                                                                                                                    | Yes                                                  |
| `totalCollected`                                   | Cash applied to invoices        | `sum(amount_applied_myr)` from payment-applications, `payment_date` in range (joined via the corrected `payment_ref → doc_entry` key — see the "RCT2 Join Trap" caveat below) | Yes                                                  |
| `outstandingAR`                                    | Open AR balance                 | `sum(total_amount_myr − paid_to_date)` where `status_code='O'`                                                                                                                | **No** — as of today                                 |
| `overdueInvoiceCount` / `overdueValue`             | Open AND past due               | same, plus `due_date < current_date` and balance `> 0.01`                                                                                                                     | **No**                                               |
| `unallocatedPayments`                              | Unapplied cash                  | `sum(unallocated_amount)` from payment headers, in period                                                                                                                     | Yes                                                  |
| `dso`                                              | Days Sales Outstanding          | `(outstandingAR / periodInvoiced) * days-in-period` (or 365 if no range selected)                                                                                             | Mixed (uses period revenue, but AR is point-in-time) |
| `collectionRatePct`                                | % of invoiced revenue collected | `periodCollected / periodInvoiced * 100`                                                                                                                                      | Yes                                                  |
| `prevPeriodInvoicedRevenue` / `prevTotalCollected` | Prior equal-length period       | `null` if no date range set                                                                                                                                                   | Prior-period                                         |

### Chart-array fields

| Array                       | Definition                                                                                                                                                     | Point-in-time?               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `arAgingData`               | Buckets: Current / 1-30 / 31-60 / 61-90 / 90+ days past due, by `current_date − due_date`; count + outstanding $ per bucket                                    | **Yes**, ignores date filter |
| `revenueTrendData`          | Monthly `invoiced_myr` vs `collected_myr`, full outer joined on month                                                                                          | Period-bound                 |
| `topOverdueCustomersData`   | Top 10 customers by outstanding $, open+overdue only                                                                                                           | **Yes**                      |
| `salesRepRevenueData`       | Per rep: order_count, revenue_myr, gross_profit_myr (GP-sanitized), gp_pct — **derived from `sap_sales_orders`, not invoices** (the one exception in this RPC) | Period-bound (`order_date`)  |
| `topCustomersByRevenueData` | Top 10 by invoiced revenue                                                                                                                                     | Period-bound                 |
| `unallocatedPaymentsData`   | Top 10 customers sitting on unapplied cash                                                                                                                     | **Yes**                      |
| `apAgingData`               | `null` placeholder — blocked on vendor-PO/AP extraction (OPOR/POR1/OPCH/PCH1/OVPM)                                                                             | n/a                          |

### KPI cards (page) — 4 pillars

Revenue Invoiced (+ Invoices Issued, Prev-Period delta) · Cash Collected (+ Collection Rate, Prev-Period delta; **not clickable** — no payments list exists to link to) · Outstanding AR (+ DSO, Unallocated Payments) · Overdue Risk (+ Overdue Invoice count).

### Charts (page)

AR Aging (bar) · Top Overdue Customers (bar) · Collection Rate (pie, built inline from `kpis` — Collected vs. `max(0, invoiced−collected)`, not the same "outstanding" figure as the AR-aging chart) · Revenue Trend (line, invoiced vs collected — subtitle explicitly warns "gross of returns/credit memos, not yet netted") · Unallocated Payments (bar) · Salesperson Health (revenue + GP bars by rep) · Top Customers by Revenue (bar).

### Layout

Tier 1 "Finance KPIs" (4 cards) → Tier 2 "AR Aging & Collections" (5 charts) + a footnote noting AP is blocked → Tier 3 "Salesperson Health & Top Customers" (2 charts).

### Notable gaps/caveats

- **AI Summary is wired but fully commented out/disabled** — `AISummary`/`GenerateAiButton` both present in code, neither rendered.
- **RCT2 Join Trap** (documented in the sibling data-platform repo): the payment-applications join must be `payment_ref → sap_payments.doc_entry`, not `receipt_number` — the two numbers coincided under SAP's old numbering series (masking the bug) until a new series activated 2024-12-20, after which joining on `receipt_number` silently breaks for every receipt since. Already fixed in this RPC, but a load-bearing correctness note for anyone touching payments elsewhere.
- A routing bug noted elsewhere in the docs: `finance/reports` is granted to Sales managers too, but `finance/invoices` is Finance-only — a Sales manager can see the KPI cards but hits "Unauthorized" on the drill-through.
- No true P&L/margin is possible without GL (OACT/JDT1) extraction — repeatedly the #1 named data gap.

---

## 7. Operations Reports (`OperationsReports.jsx`, RPC `get_operations_dashboard`)

**Core question:** are we shipping what customers ordered — in full, on time — and what's stuck in the pipeline right now? Newest of the four; no AI Summary at all yet.

### KPI formulas

| Field                                                                   | Meaning                                                     | Formula                                                                                                                 | Point-in-time?               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `openOrderCount` / `openOrderValue`                                     | Backlog count/$                                             | `count`/`sum(total_amount_myr)` where `status_code='O'`                                                                 | **Yes**                      |
| `undeliveredUnits`                                                      | Open quantity across all order lines                        | `sum(open_qty)`                                                                                                         | **Yes**, no status filter    |
| `fillRatePct`                                                           | Delivered vs ordered qty                                    | `sum(delivered_qty)/sum(quantity)*100`, scoped by **order date**                                                        | Period-bound                 |
| `onTimeVsRequestPct`                                                    | On/before customer's requested date                         | `count(actual_delivery_date ≤ requested_delivery_date) / count(*)`, scoped by **actual delivery date**                  | Period-bound                 |
| `onTimeVsPromisePct`                                                    | On/before internal promised date                            | Same structure, vs. the delivery doc's own `promised_delivery_date` (a distinct column from the order's requested date) | Period-bound                 |
| `avgOrderToShipDays` / `avgShipToInvoiceDays` / `avgOrderToInvoiceDays` | Cycle-time averages across the order→delivery→invoice chain | `avg(date − date)` in days; **all three** scoped by the chain's **order_date**, even `ship_to_invoice`                  | Period-bound (by order_date) |

Three distinct "delivery date" concepts feed these, worth keeping straight in any redesign: (a) actual delivery date, (b) the delivery document's own promised date, (c) the order's own `delivery_date` field, used as the customer's requested date.

### Chart-array fields

| Array                     | Definition                                                                                                                                                                                                                                                                                        | Point-in-time?               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `backlogAgingData`        | Buckets 0-30/31-60/61-90/90+ days since `order_date`, open orders only                                                                                                                                                                                                                            | **Yes**                      |
| `shipmentTrendData`       | Monthly delivery document count                                                                                                                                                                                                                                                                   | Period-bound (delivery date) |
| `topUndeliveredItemsData` | Top 10 items by open quantity                                                                                                                                                                                                                                                                     | **Yes**                      |
| `stockPositionData`       | Company-wide (not per-warehouse — blocked on OITW extraction): `stock_on_hand`, `committed_stock`, `on_order`, `available_qty` (`stock_on_hand − committed_stock`), `is_over_committed`; sorted over-committed-first then lowest-stock — i.e. surfaces the worst stock-risk items, not top-volume | **Yes**                      |

### KPI cards (page)

Open Order Backlog (+ Open Orders count, Undelivered Units) · On-Time Delivery vs. Request (+ vs. Internal Promise) · Fill Rate (+ Undelivered Units) · Fulfilment Cycle Time = avg order→invoice (+ Order→Ship, Ship→Invoice). None of the four cards link anywhere.

### Charts (page)

Backlog Aging (bar) · Shipment Volume Trend (line) · Top Undelivered Items (bar) · Stock Position (on-hand vs. committed bars — `on_order`/`available_qty`/`is_over_committed` are returned by the RPC but **not** currently used in the chart).

### Layout

Tier 1 "Operations KPIs" (4 cards) → Tier 2 "Fulfilment Health" (Backlog Aging + Shipment Trend) → Tier 3 "Backlog & Stock Detail" (Top Undelivered Items + Stock Position), with an explicit note that stock is company-wide only pending per-warehouse extraction.

### Notable gaps/caveats

- No AI Summary, no filter dropdowns at all (only the date range) — `filterConfig.js` returns an empty array by design, pending a warehouse filter once OWHS lands.
- Freshness banner watches `sap_sales_orders`/`sap_deliveries`/`sap_items` but **not** `sap_invoices`, despite two KPIs depending on invoice data.
- `stockPositionData`'s `available_qty`/`is_over_committed` fields are computed but unused in the current chart — a ready-made hook for a future redesign (e.g. a dedicated over-committed-items badge).

---

## 8. Suggested next step

With this reference in hand, the natural follow-up is a per-department pass deciding what to add/cut/reshape for management vs. staff vs. exec consumption on each Reports page. Candidate discussion points already visible from the caveats above:

- Bring Sales Reports and Operations Reports up to parity with Leads Overview on period-over-period deltas and AI Executive Briefings (both patterns exist and are proven elsewhere in the app).
- Decide whether to finish and re-enable Finance's commented-out AI Summary.
- Fix the `finance/reports` vs. `finance/invoices` access-control mismatch for Sales managers.
- Decide the fate of the dormant `sales_orders` and `sales_attainment_snapshots` tables (lead→SAP-order bridge; locked period-end attainment for audit/comp) before building anything that assumes live-recomputed attainment is good enough long-term.
- Surface `stockPositionData`'s unused `available_qty`/`is_over_committed` fields on Operations Reports.

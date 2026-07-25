# Dashboard Current State (as-built)

What actually exists today, page by page: every KPI, every chart, exactly how each is calculated, which tables feed it, and known gaps/bugs. This is a living document — update it as pages ship or change. For naming/build conventions, see [`DASHBOARD-CONVENTIONS.md`](./DASHBOARD-CONVENTIONS.md); for what's planned next, see [`DASHBOARD-ROADMAP.md`](./DASHBOARD-ROADMAP.md).

## 1. Dashboard inventory

| Dashboard | Route | Tier | Audience / cadence | RPC | Page component |
| --- | --- | --- | --- | --- | --- |
| Sales Leads Overview | `sales/leads/overview` | 2 | Sales reps + manager, daily | `get_sales_leads_dashboard` | `LeadsOverview.jsx` |
| Sales Reports | `sales/reports` | 3 | Sales Manager + execs, monthly/quarterly | `get_sales_reports_dashboard` | `Reports.jsx` |
| Finance Reports | `finance/reports` | 3 | Finance + execs | `get_finance_dashboard` | `FinancialReports.jsx` |
| Operations Reports | `operations/reports` | 3 | Ops Manager + execs | `get_operations_dashboard` | `OperationsReports.jsx` |

Tier 4 (Executive Summary, cross-department) does not exist yet.

## 2. Module-by-module page audit

### Sales (`SalesRoutes.jsx`, `src/pages/user/sales/`)

- `sales/reports` — **not a native dashboard**: a bare `<iframe>` embedding a Google Looker Studio report, no KPIs/charts from the app's component library. This is the Sales module's default landing route.
- `sales/clients/overview`, `sales/clients/contacts` — literal empty stubs.
- `sales/clients/list` — fully built CRUD (SAP BP ID, name, address, industry).
- `sales/leads/overview` (`LeadsOverview.jsx`, 579 lines) — **the most mature page in the app**: Tier-1 KPI cards, per-rep scorecard, Tier-2/3 charts, AI summary, PDF export. See §4 below.
- `sales/leads/list` — fully built CRUD with a stage-transition workflow (DISCOVERY → SAMPLE_TEST → PROPOSAL → NEGOTIATION → WON/LOST); captures `po_number`/`po_document_url`/`quotation_url`/`actual_revenue` at the WON transition, manually typed, not pulled from SAP.
- `sales/quotations` — orphan route: nav entry commented out, page is an empty stub.
- No dedicated Invoices/PO/Targets-management submodule. "Targets" exist only as a read-only RPC (`get_sales_targets_prorated`); no in-app UI to create/edit them.

### Finance (`FinanceRoutes.jsx`, `src/pages/user/finance/`)

- `finance/reports` (`FinancialReports.jsx`, 413 lines) — already correctly Tier-3 shaped (in-code comments literally mark `TIER 1`/`TIER 2`/`TIER 3`). See §6 below.
- `finance/invoices` — correctly Tier-1-only, read-only ("SAP is the system of record... drill-through target for the Finance dashboard's KPI cards").
- `finance/payments`, `finance/claims-management` — literal empty stubs, no backing data.
- **Bug**: `FinanceRoutes.jsx` grants `finance/reports` to `["FIN", "SAL"]` managers but `finance/invoices` to `["FIN"]` only — a Sales manager sees Reports' KPI cards but hits "Unauthorized" on the drill-through. Fix regardless of anything else.
- No Purchase Order concept anywhere; no vendor-PO extraction exists on the data-platform side.

### HR (`HRRoutes.jsx`, `src/pages/user/hr/`)

- `hr/employees/overview` — fully built, but **two bugs**: "Inactive Employees" card is bound to `kpis.terminatedEmployees` (should be a separate `inactiveEmployees` card); "Average Team Size" card is bound to `kpis.employeesWithoutManager` instead of the hook's already-correct `avgTeamSize`.
- `hr/employees/list` — fully built CRUD.
- `hr/attendance/overview` — **literal empty stub**, despite a rich, already-built dual-source (Vigilance biometric + app self-service) `unified_daily_attendance` view computing per-employee-per-day `first_in`/`last_out`, reconciliation, `hours_worked`, and an `hr_flag` anomaly field. **The single highest-leverage opportunity in this app** — see roadmap.
- `hr/attendance/list` — fully built (467 lines): daily-grouped views, approve/reject workflow, clock-out action, photo upload, anomaly badge.
- `hr/departments`, `hr/leaves`, `hr/recruitment`, `hr/performance` — flat literal stubs.
- `hr/reports` — **broken, not just unbuilt**: nav entry exists, but `HRRoutes.jsx` has no matching route at all. Dead link in production.
- Leave: fully designed schema (`leave_types`/`leave_balances`/`leave_requests`/`leave_holidays`), zero rows ever written or read.

### IT (`ITRoutes.jsx`, `src/pages/user/it/`)

- `it/assets/overview` — fully built: 4 KPI cards + 7 charts.
- `it/assets/list` — fully built CRUD.
- `it/software` — pure stub, no backing schema anywhere.
- `it/dashboard` (`ITDashboard.jsx`) — despite the name, not an analytics page: a `QuickActions` grid of external links only, zero Supabase queries. Rename away from "Dashboard."
- No Tier-3 "IT Reports" page — correctly deferred; IT has exactly one real Tier-2 source (Assets) today.

### Cross-cutting IA pattern

The Overview-vs-List shape mismatch (some submodules have both, some are flat stubs) recurs identically across Sales/Finance/HR/IT — it's one convention gap (see `DASHBOARD-CONVENTIONS.md` §2), not four separate module-by-module decisions.

## 3. Data source map (existing dashboards only)

| Table | Used by |
| --- | --- |
| `sales_leads`, `sales_leads_stage_history` | Leads Overview, Sales Reports |
| `sales_targets` (Forecast 1) | Leads Overview (`scorecardData`), Sales Reports (`pipeline_target_math`) |
| `sales_budgets` (Forecast 2) | Sales Reports only |
| `sales_leads_lose_reasons`, `lead_source_types`, `clients` | Leads Overview + Sales Reports composition charts |
| `employees`, `profiles` | Leads Overview, Sales Reports (display-only join for SAP-keyed rows) |
| `sap_sales_persons` | Sales Reports, Finance |
| `sap_sales_orders` | Sales Reports (order book), Finance (`salesRepRevenueData` — only RPC output derived from orders, not invoices), Operations (backlog) |
| `sap_sales_order_lines` | Operations only (fill rate, undelivered units/items) |
| `sap_invoices` | Sales Reports, Finance (core), Operations (`full_chain` cycle-time only) |
| `sap_invoice_lines` | Operations only (order→delivery→invoice chain) |
| `sap_deliveries`, `sap_delivery_lines` | Operations only |
| `sap_items` | Operations only (stock position, undelivered items) |
| `sap_payments`, `sap_payment_applications` | Finance only — see `DASHBOARD-CONVENTIONS.md`'s RCT2 watch-outs before trusting invoice attribution from `sap_payment_applications` |
| `sap_customers` | Finance (customer filter search) |
| `sap_pipeline_state` | Freshness banners on Sales Reports, Finance, Operations |
| `sales_orders`, `sales_attainment_snapshots` | **Dormant** — schema exists, zero application code reads/writes either |

## 4. Sales Leads Overview (`LeadsOverview.jsx`, RPC `get_sales_leads_dashboard`)

**Core question:** is the pipeline healthy today, and how is each rep tracking against quota?

| Field | Formula | Period-bound? |
| --- | --- | --- |
| `totalLeadsCreated` | `count(*)` where `created_at` in range | Yes |
| `pipelineGenerated` | `sum(expected_revenue)` where `created_at` in range | Yes |
| `wonLeads`/`wonRevenue` | `count`/`sum(actual_revenue)` where `stage='WON'`, `closed_date` in range | Yes |
| `avgDealSize` | `avg(actual_revenue)`, WON, closed in range | Yes |
| `lostLeads`/`lostRevenue` | `count`/`sum(expected_revenue)` where LOST or cancelled, closed in range | Yes |
| `winRate` | `WON / (WON+LOST)` (cancelled excluded from denominator) | Yes |
| `activeLeads`/`activePipelineValue` | `count`/`sum(expected_revenue)` where not WON/LOST/cancelled | **No** — real-time snapshot |
| `weightedPipelineValue` | `sum(expected_revenue * close_probability/100)`, active leads | **No** |
| `avgDaysToClose` | `avg(closed_date − created_at)`, WON in range | Yes |
| `forecastVariance` | `sum(actual_revenue) − sum(expected_revenue)`, WON in range | Yes |
| `fastTrackDeals` | Created AND won inside the same period | Yes |

Charts: Lead Stages (count by stage) · Active Pipeline Health (by probability bucket, $) · Revenue Lost (by reason) · Pipeline Activity/Revenue Trend Over Time · Executive Leaderboards (Product/Owner/Source/Clients, 3-way lens toggle: Productivity/Accuracy/Execution).

**Notable gaps:** no freshness banner anywhere on this page. `scorecardData`'s target proration ignores the owner filter — can leak other reps into a single-rep view. Several imported color constants appear unused in the JSX.

## 5. Sales Reports (`Reports.jsx`, RPC `get_sales_reports_dashboard`)

**Core question:** is the department hitting both its pipeline and invoiced-revenue forecasts, and where is growth/risk concentrated? Surfaces **both** forecasts side by side, deliberately never blended.

| Field | Meaning | Source |
| --- | --- | --- |
| `pipelineTargetRevenue` | Prorated Forecast-1 target, dept-wide | `sales_targets` |
| `pipelineWonRevenue` | WON actual revenue, CRM | `sales_leads` |
| `orderBookValue` | SAP orders booked in period | `sap_sales_orders` |
| `winRatePct`, `avgDealSize`, `avgDaysToClose` | Same definitions as Leads Overview | `sales_leads` |
| `quoteToWinConversionPct` | Quoted leads that won | `sales_leads.quotation_url` |

`invoiceBudgetScorecardData` (Forecast 2, per-rep): `invoiced_revenue` (`sum(sap_invoices.total_amount_myr)`, in period), `budget_revenue` (prorated `sales_budgets.budget_revenue`), `attainment_percentage`. Display fields (`rep_name`/`avatar_url`) joined via `sap_sales_persons.employee_id = employees.employee_id`, never for the math. `full outer join` so a rep with invoices-but-no-budget still appears.

Charts: Realized (SAP) vs Pipeline (CRM) Revenue — explicitly "not blended" · Order Book by Rep · Gross Profit by Rep · Product-Type Mix · Lead-Source ROI · Top Clients.

**Notable gaps:** no AI Summary, no period-over-period delta (both present elsewhere in the app). A stray `console.log(dashboard)` debug line is still present. `sales_budgets.budget_gross_profit` was proposed but never added to the real migration — no GP-based budget view possible today. `sales_attainment_snapshots` exists but is unused — attainment is always live-recomputed, so it can shift retroactively if invoices are cancelled/corrected after the fact.

## 6. Finance Reports (`FinancialReports.jsx`, RPC `get_finance_dashboard`)

**Stated directly in the codebase:** Finance today is an AR subledger with a "Finance" label on it — every KPI is revenue/collections/AR, never a true P&L/margin figure, because there's no GL/Chart-of-Accounts extraction from SAP.

| Field | Formula | Period-bound? |
| --- | --- | --- |
| `periodInvoicedRevenue`/`periodInvoiceCount` | `sum`/`count` from `sap_invoices`, `invoice_date` in range | Yes |
| `totalCollected` | `sum(amount_applied_myr)`, `payment_date` in range | Yes |
| `outstandingAR` | `sum(total_amount_myr − paid_to_date)` where `status_code='O'` | **No** |
| `overdueInvoiceCount`/`overdueValue` | Open AND `due_date < current_date` and balance `> 0.01` | **No** |
| `dso` | `(outstandingAR / periodInvoiced) * days-in-period` | Mixed (point-in-time AR ÷ period revenue) |
| `collectionRatePct` | `periodCollected / periodInvoiced * 100` | Yes |

> **DSO methodology note:** this point-in-time-snapshot DSO formula (`outstandingAR / periodInvoiced × days`, already live) is a different methodology from the classic average-AR-based DSO (`Avg AR / Total credit sales × days`) that `hyrax-data-platform/docs/sap-data-architecture-plans/02-department-kpi-frameworks.md` recommends for the target KPI framework. Neither is wrong, but they'd disagree on the same data — this needs a canonical-formula decision (see roadmap), not a silent pick.

Charts: AR Aging (bar, ignores date filter) · Top Overdue Customers · Collection Rate (pie) · Revenue Trend (invoiced vs collected — subtitle warns "gross of returns/credit memos, not yet netted") · Unallocated Payments · Salesperson Health (revenue + GP by rep, from `sap_sales_orders` — the one exception to invoice-based figures) · Top Customers by Revenue.

**Notable gaps:** AI Summary is wired but fully commented out/disabled. **RCT2 join note**: the payment-applications join must be `payment_ref → sap_payments.doc_entry`, not `receipt_number` (see `hyrax-data-platform/docs/data-dictionary.md`'s RCT2 Join Trap) — already fixed in this RPC. Separately, which column (`inv_entry` vs `doc_entry`) is the true FK from a payment application to the *invoice* it settles is an **open, disputed question** — this RPC currently joins on `inv_entry`, which per the data-platform docs' corrected research may be wrong; not yet fixed pending live-SAP verification (see roadmap). `finance/reports` is granted to Sales managers too, but `finance/invoices` is Finance-only (see §2's routing bug). No true P&L/margin is possible without GL extraction — repeatedly the #1 named data gap.

## 7. Operations Reports (`OperationsReports.jsx`, RPC `get_operations_dashboard`)

**Core question:** are we shipping what customers ordered — in full, on time — and what's stuck in the pipeline right now? Newest of the four; no AI Summary at all yet.

| Field | Formula | Point-in-time? |
| --- | --- | --- |
| `openOrderCount`/`openOrderValue` | `count`/`sum(total_amount_myr)` where `status_code='O'` | **Yes** |
| `undeliveredUnits` | `sum(open_qty)` across all order lines | **Yes** |
| `fillRatePct` | `sum(delivered_qty)/sum(quantity)*100`, scoped by order date | Period-bound |
| `onTimeVsRequestPct` | `count(actual_delivery_date ≤ requested_delivery_date) / count(*)` | Period-bound |
| `onTimeVsPromisePct` | vs. the delivery doc's own `promised_delivery_date` | Period-bound |
| `avgOrderToShipDays`/`avgShipToInvoiceDays`/`avgOrderToInvoiceDays` | Cycle-time averages, all scoped by order_date | Period-bound |

Three distinct "delivery date" concepts feed these: (a) actual delivery date, (b) the delivery doc's own promised date, (c) the order's own `delivery_date` (customer's requested date).

Charts: Backlog Aging (bar) · Shipment Volume Trend (line) · Top Undelivered Items (bar) · Stock Position (on-hand vs committed — `on_order`/`available_qty`/`is_over_committed` returned but **not** currently charted).

**Notable gaps:** no AI Summary, no filter dropdowns besides date range. Freshness banner watches `sap_sales_orders`/`sap_deliveries`/`sap_items` but **not** `sap_invoices`, despite two KPIs depending on invoice data.

## 8. Suggested next step

See `DASHBOARD-ROADMAP.md` for the prioritized punch-list this audit feeds into.

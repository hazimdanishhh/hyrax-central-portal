# Dashboard Current State (as-built)

What actually exists today, page by page: every KPI, every chart, exactly how each is calculated, which tables feed it, and known gaps/bugs. This is a living document — update it as pages ship or change. For naming/build conventions, see [`DASHBOARD-CONVENTIONS.md`](./DASHBOARD-CONVENTIONS.md); for what's planned next, see [`DASHBOARD-ROADMAP.md`](./DASHBOARD-ROADMAP.md); for the exact formula/source-table behind every RPC field, see [`RPC-REFERENCE.md`](./RPC-REFERENCE.md).

## 1. Dashboard inventory

| Dashboard            | Route                  | Tier | Audience / cadence                       | RPC                           | Page component          |
| -------------------- | ---------------------- | ---- | ---------------------------------------- | ----------------------------- | ----------------------- |
| Sales Leads Overview | `sales/leads/overview` | 2    | Sales reps + manager, daily              | `get_sales_leads_dashboard`   | `LeadsOverview.jsx`     |
| Sales Reports        | `sales/reports`        | 3    | Sales Manager + execs, monthly/quarterly | `get_sales_reports_dashboard` | `Reports.jsx`           |
| Finance Reports      | `finance/reports`      | 3    | Finance + execs                          | `get_finance_dashboard`       | `FinancialReports.jsx`  |
| Operations Reports   | `operations/reports`   | 3    | Ops Manager + execs                      | `get_operations_dashboard`    | `OperationsReports.jsx` |

Tier 4 (Executive Summary, cross-department) does not exist yet.

## 2. Module-by-module page audit (Not up to date with current build)

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
- `finance/claims-management` — literal empty stub, no backing data.
- `finance/bills`, `finance/vendor-payments` (added 2026-07, Finance Expansion Phase 1) — AP mirrors of `finance/invoices`/`finance/payments`, same Tier-1-only read-only shape, same access-control pattern.
- **Bug**: `FinanceRoutes.jsx` grants `finance/reports` to `["FIN", "SAL"]` managers but `finance/invoices` (and now `finance/bills`/`finance/vendor-payments`) to `["FIN"]` only — a Sales manager sees Reports' KPI cards but hits "Unauthorized" on the drill-through. Fix regardless of anything else.
- No Purchase Order concept anywhere; no vendor-PO extraction exists on the data-platform side (Accounts Payable — vendor bills and outgoing payments — is now extracted and dashboarded; the PO→GRPO→Bill chain that would enable DPO/spend-variance-by-PO analysis is a separate, not-yet-built initiative).

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

| Table                                                      | Used by                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `sales_leads`, `sales_leads_stage_history`                 | Leads Overview, Sales Reports                                                                                                         |
| `sales_targets` (Forecast 1)                               | Leads Overview (`scorecardData`), Sales Reports (`pipeline_target_math`)                                                              |
| `sales_budgets` (Forecast 2)                               | Sales Reports only                                                                                                                    |
| `sales_leads_lose_reasons`, `lead_source_types`, `clients` | Leads Overview + Sales Reports composition charts                                                                                     |
| `employees`, `profiles`                                    | Leads Overview, Sales Reports (display-only join for SAP-keyed rows)                                                                  |
| `sap_sales_persons`                                        | Sales Reports, Finance                                                                                                                |
| `sap_sales_orders`                                         | Sales Reports (order book), Finance (`salesRepRevenueData` — only RPC output derived from orders, not invoices), Operations (backlog) |
| `sap_sales_order_lines`                                    | Operations only (fill rate, undelivered units/items)                                                                                  |
| `sap_invoices`                                             | Sales Reports, Finance (core), Operations (`full_chain` cycle-time only)                                                              |
| `sap_invoice_lines`                                        | Operations only (order→delivery→invoice chain)                                                                                        |
| `sap_deliveries`, `sap_delivery_lines`                     | Operations only                                                                                                                       |
| `sap_items`                                                | Operations only (stock position, undelivered items)                                                                                   |
| `sap_payments`, `sap_payment_applications`                 | Finance only — see `DASHBOARD-CONVENTIONS.md`'s RCT2 watch-outs before trusting invoice attribution from `sap_payment_applications`   |
| `sap_vendor_bills`, `sap_vendor_bill_lines` (added 2026-07) | Finance only — AP mirror of `sap_invoices`/`sap_invoice_lines`; also the Bills list page's line-item drill-through                    |
| `sap_vendor_payments`, `sap_vendor_payment_applications` (added 2026-07) | Finance only — AP mirror of `sap_payments`/`sap_payment_applications`; see "VPM2 Join Trap" in `data-dictionary.md` before trusting bill attribution |
| `sap_customers`                                            | Finance (customer filter search; also vendor filter search, via `card_type = 'S'`, added 2026-07)                                     |
| `sap_gl_accounts`, `sap_gl_journal_entries`, `sap_gl_journal_lines` (added 2026-07) | Finance only — General Ledger; powers `netProfit`/`ebitda`/`currentRatio`/`quickRatio`/`workingCapital` and the P&L/Balance Sheet charts. See `data-dictionary.md`'s "GL Hierarchy & Sign Convention" before extending |
| `sap_pipeline_state`                                       | Freshness banners on Sales Reports, Finance, Operations                                                                               |
| `sales_orders`, `sales_attainment_snapshots`               | **Dormant** — schema exists, zero application code reads/writes either                                                                |

## 4. Sales Leads Overview (`LeadsOverview.jsx`, RPC `get_sales_leads_dashboard`)

**Core question:** is the pipeline healthy today, and how is each rep tracking against quota?

| Field                               | Formula                                                                   | Period-bound?               |
| ----------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| `totalLeadsCreated`                 | `count(*)` where `created_at` in range                                    | Yes                         |
| `pipelineGenerated`                 | `sum(expected_revenue)` where `created_at` in range                       | Yes                         |
| `wonLeads`/`wonRevenue`             | `count`/`sum(actual_revenue)` where `stage='WON'`, `closed_date` in range | Yes                         |
| `avgDealSize`                       | `avg(actual_revenue)`, WON, closed in range                               | Yes                         |
| `lostLeads`/`lostRevenue`           | `count`/`sum(expected_revenue)` where LOST or cancelled, closed in range  | Yes                         |
| `winRate`                           | `WON / (WON+LOST)` (cancelled excluded from denominator)                  | Yes                         |
| `activeLeads`/`activePipelineValue` | `count`/`sum(expected_revenue)` where not WON/LOST/cancelled              | **No** — real-time snapshot |
| `weightedPipelineValue`             | `sum(expected_revenue * close_probability/100)`, active leads             | **No**                      |
| `avgDaysToClose`                    | `avg(closed_date − created_at)`, WON in range                             | Yes                         |
| `forecastVariance`                  | `sum(actual_revenue) − sum(expected_revenue)`, WON in range               | Yes                         |
| `fastTrackDeals`                    | Created AND won inside the same period                                    | Yes                         |

Charts: Lead Stages (count by stage) · Active Pipeline Health (by probability bucket, $) · Revenue Lost (by reason) · Pipeline Activity/Revenue Trend Over Time · Executive Leaderboards (Product/Owner/Source/Clients, 3-way lens toggle: Productivity/Accuracy/Execution).

**Notable gaps:** no freshness banner anywhere on this page. `scorecardData`'s target proration ignores the owner filter — can leak other reps into a single-rep view. Several imported color constants appear unused in the JSX.

## 5. Sales Reports (`Reports.jsx`, RPC `get_sales_reports_dashboard`)

**Core question:** is the department hitting both its pipeline and invoiced-revenue forecasts, and where is growth/risk concentrated? Surfaces **both** forecasts side by side, deliberately never blended.

| Field                                         | Meaning                               | Source                      |
| --------------------------------------------- | ------------------------------------- | --------------------------- |
| `pipelineTargetRevenue`                       | Prorated Forecast-1 target, dept-wide | `sales_targets`             |
| `pipelineWonRevenue`                          | WON actual revenue, CRM               | `sales_leads`               |
| `orderBookValue`                              | SAP orders booked in period           | `sap_sales_orders`          |
| `winRatePct`, `avgDealSize`, `avgDaysToClose` | Same definitions as Leads Overview    | `sales_leads`               |
| `quoteToWinConversionPct`                     | Quoted leads that won                 | `sales_leads.quotation_url` |

`invoiceBudgetScorecardData` (per-rep, resolved 2026-07 to be the company's actual sales-side review — **PO (sales order) vs Invoice vs Budget variance**, not just Forecast 2 in isolation): `order_value_myr` (`sum(sap_sales_orders.total_amount_myr)`, in period), `invoiced_revenue` (`sum(sap_invoices.total_amount_myr)`, in period), `budget_revenue` (prorated `sales_budgets.budget_revenue`), `attainment_percentage` (invoice vs budget), `po_vs_budget_variance_myr`, `po_vs_invoice_variance_myr` (booked-but-not-yet-invoiced backlog). All three legs keyed by `sales_rep_code`. Display fields (`rep_name`/`avatar_url`) joined via the `employee_sales_rep_mapping` bridge table, never for the math — **not** `sap_sales_persons.employee_id = employees.employee_id` (EmpID), which is confirmed broken (type mismatch, empty in production, wrong conceptual target) and has been replaced; see `DASHBOARD-ROADMAP.md` §1.1. `full outer join` across all three legs so a rep with orders/invoices-but-no-budget still appears. Exact formulas: `RPC-REFERENCE.md`.

Charts: Realized (SAP) vs Pipeline (CRM) Revenue — explicitly "not blended" · Order Book by Rep (same `order_value_myr` figures as the scorecard, reshaped for the chart) · Gross Profit by Rep · Product-Type Mix · Lead-Source ROI · Top Clients.

**Notable gaps:** no AI Summary, no period-over-period delta (both present elsewhere in the app). A stray `console.log(dashboard)` debug line is still present. `sales_budgets.budget_gross_profit` was proposed but never added to the real migration — no GP-based budget view possible today. `sales_attainment_snapshots` exists but is unused — attainment is always live-recomputed, so it can shift retroactively if invoices are cancelled/corrected after the fact.

## 6. Finance Reports (`FinancialReports.jsx`, RPC `get_finance_dashboard`)

**Stated directly in the codebase:** Finance was, until 2026-07, mostly an AR subledger with a "Finance" label on it, plus a Gross Profit figure read straight off SAP's own per-invoice field. Finance Expansion Phase 1 (2026-07) added the mirror-image Accounts Payable chain (bills received, cash paid, AP aging, DPO). Finance Expansion Phase 2 (2026-07) added a real General Ledger extraction (OACT/OJDT/JDT1) and, with it, this dashboard's first true P&L (Net Profit, Net Profit Margin, an approximate EBITDA) and balance-sheet ratios (Current Ratio, Quick Ratio, Working Capital) computed from actual GL postings rather than subledger proxies. See `hyrax-data-platform/docs/sap-data-architecture-plans/06-finance-expansion-execution-plan.md` for the full build and `hyrax-data-platform/docs/data-dictionary.md`'s "GL Hierarchy & Sign Convention" section before trusting or extending any of the GL-derived figures below — both the chart-of-accounts category structure and the balance sign convention are non-obvious.

| Field | Formula | Period-bound? |
| --- | --- | --- |
| `periodInvoicedRevenue`/`periodInvoiceCount` | `sum`/`count` from `sap_invoices`, `invoice_date` in range | Yes |
| `totalCollected` | `sum(amount_applied_myr)`, `payment_date` in range | Yes |
| `outstandingAR` | `sum(total_amount_myr − paid_to_date)` where `status_code='O'` | **No** |
| `overdueInvoiceCount`/`overdueValue` | Open AND `due_date < current_date` and balance `> 0.01` | **No** |
| `dso` | `(Avg AR / periodInvoiced) * days-in-period`, Avg AR = (Beginning AR + Ending AR) / 2, Beginning AR derived from Ending AR via the accounting identity `Ending − Invoiced + Collected` (no historical AR snapshot exists) | Mixed (average-AR, but Ending AR is still an "as of today" snapshot) |
| `collectionRatePct` | `periodCollected / periodInvoiced * 100` | Yes |
| `periodGrossProfit`/`grossProfitMarginPct` (added 2026-07) | `sum(gross_profit_sanitized)` / `periodGrossProfit ÷ periodInvoiced * 100` | Yes |
| `periodBilled`/`periodBillCount` (added 2026-07) | `sum`/`count` from `sap_vendor_bills`, `bill_date` in range — AP mirror of `periodInvoicedRevenue` | Yes |
| `totalPaid` (added 2026-07) | `sum(amount_applied_myr)` from the VPM2 chain, `payment_date` in range — AP mirror of `totalCollected` | Yes |
| `outstandingAP` (added 2026-07) | `sum(total_amount_myr − paid_to_date)` from `sap_vendor_bills` where `status_code='O'` — AP mirror of `outstandingAR` | **No** |
| `overdueBillCount`/`overdueBillValue` (added 2026-07) | Open AND `due_date < current_date` and balance `> 0.01` — AP mirror of `overdueInvoiceCount`/`overdueValue` | **No** |
| `unallocatedOutgoingPayments` (added 2026-07) | `sum(unallocated_amount)` from `sap_vendor_payments` — AP mirror of `unallocatedPayments` | Yes |
| `dpo` (added 2026-07) | Same average-AP methodology as the reconciled `dso` above, launched consistent from day one (no point-in-time-first shortcut) | Mixed (average-AP, Ending AP still "as of today") |
| `netArApPosition` (added 2026-07) | `outstandingAR − outstandingAP` — a subledger-level signal, kept alongside (not replaced by) the GL-based `workingCapital` below | **No** |
| `glPeriodRevenue`/`glPeriodCOGS`/`glGrossProfit`/`glGrossProfitMarginPct` (added 2026-07) | Sum of `sap_gl_journal_lines` postings under the Turnover(4)/Cost Of Sales(5) drawers — a SEPARATE figure from `periodGrossProfit` above (that one sums SAP's own per-invoice `GrosProfit`; this one derives from actual GL postings) — the two won't generally reconcile exactly | Yes |
| `glOperatingExpenses`/`glOperatingProfit`/`glOtherExpenditure`/`glTax` (added 2026-07) | Sum of postings under Expenses(6)/Other Expenditure(7)/Taxation(8) | Yes |
| `netProfit`/`netProfitMarginPct` (added 2026-07) | Revenue − COGS − OpEx − Other Expenditure − Tax, from actual GL postings | Yes |
| `ebitda`/`ebitdaMarginPct` (added 2026-07) | Net Profit + Interest + Tax + Depreciation/Amortization added back — **approximate**: Interest is structural (the "7200 Financial Related" chart-of-accounts subtree), but Depreciation/Amortization is name-pattern-matched (`account_name ILIKE '%depreciation%'`), not structural — Hyrax's chart of accounts splits D&A across two different drawers with no single clean category for it | Yes |
| `currentAssets`/`fixedAssets`/`totalAssets`/`currentLiabilities`/`totalLiabilities`/`totalEquity` (added 2026-07) | Sum of `sap_gl_accounts.current_balance_myr` for postable accounts, classified via a recursive walk of the chart-of-accounts hierarchy — Liabilities/Equity are negated (stored negative in SAP, see the data-platform data-dictionary's sign-convention note) | **No** |
| `currentRatio`/`quickRatio` (added 2026-07) | Current Assets ÷ Current Liabilities; Quick Ratio additionally excludes Inventories and Prepayment from Current Assets | **No** |
| `workingCapital` (added 2026-07) | Current Assets − Current Liabilities, from actual GL balances (the complete figure `netArApPosition` above was an interim proxy for) | **No** |

> **DSO methodology note — resolved 2026-07:** this dashboard's DSO formula previously used a point-in-time snapshot (`outstandingAR / periodInvoiced × days`), a different methodology from the classic average-AR-based DSO (`Avg AR / Total credit sales × days`) that `hyrax-data-platform/docs/sap-data-architecture-plans/02-department-kpi-frameworks.md` recommends for the target KPI framework. The two disagreed on the same data. Now reconciled: the live formula computes Avg AR from Ending AR (`outstandingAR`) via the accounting identity `Beginning AR = Ending AR − periodInvoiced + totalCollected` (clamped at 0), since no historical AR snapshot exists to observe Beginning AR directly — see the derivation comment in `get_finance_dashboard_rpc.sql`. One approximation remains, documented there: Ending AR is still an "as of today" snapshot, not strictly "as of the selected period's end date."
>
> **Why `periodInvoicedRevenue − totalCollected` doesn't equal `outstandingAR` (confirmed 2026-07, not a bug):** `outstandingAR` is read straight from SAP's own `paid_to_date` bookkeeping per invoice, with no RCT2 join involved. `totalCollected` is derived from the separate RCT2 payment-applications table, which can only attribute cash settled via `inv_type = 13` — on-account cash, credit memos, and other document types reduce an invoice's real `paid_to_date` without ever appearing in `totalCollected`. So the two figures come from different SAP sources measuring related-but-distinct things; they were never going to reconcile arithmetically, even with no date filter applied. Full formulas and a diagnostic query to quantify the gap: `RPC-REFERENCE.md`.

Charts: AR Aging (bar, ignores date filter) · Top Overdue Customers · Collection Rate (pie) · Revenue Trend (invoiced vs collected — subtitle warns "gross of returns/credit memos, not yet netted") · Unallocated Payments · Salesperson Health (invoiced revenue + GP + cash collected by rep, from `sap_invoices`/`sap_payment_applications` — resolved 2026-07, was previously `sap_sales_orders`; see below) · Top Customers by Revenue · **(added 2026-07, Phase 1)** AP Aging (bar, ignores date filter — real data, replacing the previous `null` contract placeholder) · Top Overdue Vendors · Top Vendors by Spend · Unallocated Outgoing Payments · **(added 2026-07, Phase 2)** P&L Breakdown (bar, Revenue through Net Profit, period-bound) · Balance Sheet Snapshot (bar, Current/Fixed Assets vs Current Liabilities/Equity, ignores date filter).

**Revenue-ownership split (resolved 2026-07):** Salesperson Health used to sum `sap_sales_orders` (order-booked value), which is why its per-rep revenue disagreed with Sales Reports' invoice-based per-rep figures — two different SAP documents, two different dates, both legitimate on their own terms but never meant to be compared directly. Per the company's actual review process (sales orders vs invoices vs budget is a sales-side question), Finance's per-rep chart now sums `sap_invoices` instead — identical, by construction, to Sales Reports' `rep_invoice_actuals`/`grossProfitByRepData` for the same rep/period — and adds `collected_myr` (cash actually applied against that rep's invoices), giving cash-collected a per-rep home instead of being buried in one aggregate KPI. The order-side PO-vs-Invoice-vs-Budget variance analysis now lives entirely in Sales Reports' `invoiceBudgetScorecardData` (see §5). Exact formulas: `RPC-REFERENCE.md`.

**Notable gaps:** AI Summary is wired but fully commented out/disabled. **RCT2 join note**: the payment-applications join must be `payment_ref → sap_payments.doc_entry`, not `receipt_number` (see `hyrax-data-platform/docs/data-dictionary.md`'s RCT2 Join Trap) — already fixed in this RPC. Separately, the true FK from a payment application to the invoice it settles is `doc_entry` filtered `inv_type = 13` (confirmed — **not** `inv_entry`); this RPC's `base_payment_apps` join was updated to match (see `hyrax-data-platform/docs/data-dictionary.md`'s "RCT2 → invoice link" section), which changes the sales-rep attribution figures here — **verify the live deployed function matches this repo's `.sql` file before trusting per-rep `collected_myr`/filtered `totalCollected`; redeploy via Supabase Studio if not.** A rep with real invoice activity but $0 `collected_myr` can mean either a genuine on-account-cash data-coverage gap (expected in moderation) or a stale live deploy (should not affect most reps) — check the live function first. `finance/reports` is granted to Sales managers too, but `finance/invoices` (and the new `finance/bills`/`finance/vendor-payments`) is Finance-only (see §2's routing bug). True P&L/Net Profit Margin/Current-Quick Ratios/Working Capital are now built (Phase 2, 2026-07) — the "no GL extraction" gap repeatedly named as the #1 data blocker in earlier drafts of this doc is resolved. What's still not built: DIO and a finalized Cash Conversion Cycle (need per-warehouse inventory valuation, Phase 3, scoped not built).

**AP chain notes (added 2026-07):** same "verify the live deploy" caveat applies to the AP side — this RPC edit only updates the repo file; `get_finance_dashboard` must be manually redeployed in Supabase Studio (and the new `ap_chain_migration.sql` run once) before any of the AP figures/charts above appear live. **VPM2 join note** (AP mirror of the RCT2 note): `payment_ref → sap_vendor_payments.doc_entry`, `doc_entry → sap_vendor_bills.doc_entry` filtered `doc_type = 18` — see `hyrax-data-platform/docs/data-dictionary.md`'s "VPM2 Join Trap." No per-vendor rep-style breakdown chart exists (vendors don't have a "sales rep" concept), so there's no AP equivalent of Salesperson Health.

**General Ledger notes (added 2026-07, Finance Expansion Phase 2):** same "verify the live deploy" caveat again — `gl_migration.sql` must be run once and `get_finance_dashboard` redeployed before any GL figure/chart above appears live. Two things worth flagging to whoever reviews these numbers against a real P&L/balance sheet: (1) **EBITDA is approximate**, not a fully audited figure — the Depreciation/Amortization add-back is name-pattern-matched (`account_name ILIKE '%depreciation%'`), because Hyrax's chart of accounts splits D&A across two different drawers (Cost Of Sales and Other Expenditure) depending on asset type, with no single clean structural category the way Interest has one (the "7200 Financial Related" subtree); (2) the "8000 Other Income" sub-category sits nested inside the Expenses drawer by Hyrax's own chart-of-accounts design, netting into `glOperatingExpenses` — this is Hyrax's actual bookkeeping choice, not a pipeline artifact, but worth knowing before treating `glOperatingExpenses` as a pure cost figure. Full formulas and the confirmed chart-of-accounts hierarchy: `RPC-REFERENCE.md` and `hyrax-data-platform/docs/data-dictionary.md`'s "GL Hierarchy & Sign Convention" section.

## 7. Operations Reports (`OperationsReports.jsx`, RPC `get_operations_dashboard`)

**Core question:** are we shipping what customers ordered — in full, on time — and what's stuck in the pipeline right now? Newest of the four; no AI Summary at all yet.

| Field                                                               | Formula                                                            | Point-in-time? |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------- |
| `openOrderCount`/`openOrderValue`                                   | `count`/`sum(total_amount_myr)` where `status_code='O'`            | **Yes**        |
| `undeliveredUnits`                                                  | `sum(open_qty)` across all order lines                             | **Yes**        |
| `fillRatePct`                                                       | `sum(delivered_qty)/sum(quantity)*100`, scoped by order date       | Period-bound   |
| `onTimeVsRequestPct`                                                | `count(actual_delivery_date ≤ requested_delivery_date) / count(*)` | Period-bound   |
| `onTimeVsPromisePct`                                                | vs. the delivery doc's own `promised_delivery_date`                | Period-bound   |
| `avgOrderToShipDays`/`avgShipToInvoiceDays`/`avgOrderToInvoiceDays` | Cycle-time averages, all scoped by order_date                      | Period-bound   |

Three distinct "delivery date" concepts feed these: (a) actual delivery date, (b) the delivery doc's own promised date, (c) the order's own `delivery_date` (customer's requested date).

Charts: Backlog Aging (bar) · Shipment Volume Trend (line) · Top Undelivered Items (bar) · Stock Position (on-hand vs committed — `on_order`/`available_qty`/`is_over_committed` returned but **not** currently charted).

**Notable gaps:** no AI Summary, no filter dropdowns besides date range. Freshness banner watches `sap_sales_orders`/`sap_deliveries`/`sap_items` but **not** `sap_invoices`, despite two KPIs depending on invoice data.

## 8. Suggested next step

See `DASHBOARD-ROADMAP.md` for the prioritized punch-list this audit feeds into.

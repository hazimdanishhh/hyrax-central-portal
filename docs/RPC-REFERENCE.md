# Dashboard RPC Reference

Field-by-field, formula-level reference for every dashboard-backing Postgres RPC in `supabase/sql_editor/`. This documents the **deployed `.sql` files in this repo** — the as-built calculations — not the target data model. For that target (SAP schema, star-schema plan, department KPI frameworks), see `hyrax-data-platform/docs/sap-data-architecture-plans/`; that repo is still just a plan, not what's implemented. For the narrative/module view of each dashboard (what page renders it, known gaps), see [`DASHBOARD-CURRENT-STATE.md`](./DASHBOARD-CURRENT-STATE.md) — this file complements that one with exact formulas, it doesn't replace it.

**Deploy mechanism, same for all four:** hand-pasted into Supabase Studio's SQL editor. No CLI/migrations/CI wired up for RPCs — editing the `.sql` file in this repo does **not** change production until someone manually re-runs it in Studio. If a dashboard's numbers don't match what's in this doc, check the live function definition first (`select pg_get_functiondef('<function_name>'::regproc);`) before assuming the calculation is wrong.

**Conventions used throughout, defined once here:**
- SAP date columns are stored as `text` — every comparison casts `"column"::date`.
- SAP boolean-ish flags are the strings `'Y'`/`'N'`, not real booleans — `is_cancelled = 'N'` means active/non-voided. Revenue must never blend cancelled docs into an active total.
- **GP sanitization guard**: `sap_*.gross_profit` has a known item-cost master-data defect at the extremes (legitimate gp/total_amount_myr ratios top out ~2.7x; defective rows run 900x-1000x+). Anywhere GP is summed, rows where `abs(gross_profit) > abs(total_amount_myr) * 5` are nulled out before summing — the row's revenue/count is untouched, only its GP contribution drops.
- **The RCT2 join trap**: `sap_payment_applications.payment_ref` joins to `sap_payments.doc_entry` — never `receipt_number` (diverged from `doc_entry` for receipts after 2024-12-20; see `hyrax-data-platform/docs/data-dictionary.md`). Separately, `sap_payment_applications.doc_entry` is the real FK to `sap_invoices.doc_entry`, but **only** when `inv_type = 13` — it's a polymorphic FK (14/18/19/24/203/other point at document types not extracted here). A payment application with `inv_type != 13` legitimately can't be attributed to an invoice or its rep — that's expected, not a bug.
- **`employee_sales_rep_mapping`** is the only valid bridge from SAP's `sales_rep_code` to Supabase `employees.id` (for display — avatar/name — never for attribution math). `sap_sales_persons.employee_id` (EmpID) is confirmed broken: empty in production, and conceptually wrong (references SAP's unused HR module). See `DASHBOARD-ROADMAP.md` §1.1.
- **Point-in-time vs. period-bound**: fields scoped by `p_start_date`/`p_end_date` are period flows; fields explicitly marked "as of today" ignore the date filter entirely (aging, backlog, stock position) because they're snapshot balances, not period activity.

---

## `get_finance_dashboard`

Backs Finance Reports (`FinancialReports.jsx`). Through 2026-06 this was mostly an AR/cash subledger, plus a Gross Profit read straight off SAP's own per-invoice `GrosProfit` field (added 2026-07). **Finance Expansion Phase 1 (2026-07)** added the mirror-image Accounts Payable chain (bills received, cash paid, AP aging, DPO, top vendors) — still no true P&L/net-margin figure or full Working Capital, since that needs a GL extraction (`OACT`/`OJDT`/`JDT1`, Phase 2, scoped but not built — see `hyrax-data-platform/docs/sap-data-architecture-plans/06-finance-expansion-execution-plan.md`).

**Signature:**
```
get_finance_dashboard(
  p_customer_code  text    default null,
  p_sales_rep_code bigint  default null,
  p_start_date     date    default null,
  p_end_date       date    default null,
  p_is_cancelled   boolean default null,  -- null/false = active docs ('N'); true = cancelled-only audit view ('Y')
  p_status_code    text    default null,  -- shared across AR (sap_invoices) and AP (sap_vendor_bills) — both use the same 'O'/'C' DocStatus convention
  p_vendor_code    text    default null   -- added 2026-07 (Finance Expansion Phase 1), AP mirror of p_customer_code
)
```

**Base CTEs:**
- `base_invoices` — `sap_invoices` filtered by `is_cancelled`, `customer_code`, `sales_rep_code`, `status_code`. Carries `gross_profit_sanitized` (the GP guard above).
- `base_payments` — `sap_payments` (ORCT header), filtered by `is_cancelled`/`customer_code`. No rep column exists on ORCT itself; used only for `unallocated_amount`.
- `base_payment_apps` — `sap_payment_applications` joined `payment_ref → sap_payments.doc_entry` (RCT2 join trap), left-joined to `sap_invoices` on `doc_entry` filtered `inv_type = 13` to resolve `invoice_sales_rep_code`. When `p_sales_rep_code` is set, rows where that join didn't resolve (`inv_type != 13` — on-account cash, other doc types) are excluded — cash that can't be attributed to a rep can't pass a rep filter. Also excludes (as of 2026-07) any row whose matched invoice doesn't share the current `is_cancelled` filter state — previously a payment applied against a since-cancelled invoice still counted toward `totalCollected` even though that invoice's own revenue was excluded from `periodInvoicedRevenue`.
- `rep_collected_actuals` — per-`sales_rep_code` sum of `amount_applied_myr` from `base_payment_apps`, `payment_date` in range. Feeds `salesRepRevenueData.collected_myr` only.
- **`base_bills`** (added 2026-07) — `sap_vendor_bills` filtered by `is_cancelled`, `vendor_code`, `status_code`. AP mirror of `base_invoices` — no rep/GP-guard analog, since OPCH carries no `sales_rep_code` and its `GrosProfit` isn't a meaningful AP concept.
- **`base_vendor_payments`** (added 2026-07) — `sap_vendor_payments` (OVPM header), filtered by `is_cancelled`/`vendor_code`. AP mirror of `base_payments`, used only for `unallocated_amount`.
- **`base_vendor_payment_apps`** (added 2026-07) — `sap_vendor_payment_applications` joined `payment_ref → sap_vendor_payments.doc_entry` (VPM2 join trap), left-joined to `sap_vendor_bills` on `doc_entry` filtered `doc_type = 18` (mirrors the `inv_type = 13` filter on the AR side). No rep-code passthrough column — vendors don't have a "sales rep" concept.

**`kpis`:**

| Field | Formula | Source | Period-bound? |
| --- | --- | --- | --- |
| `periodInvoicedRevenue` | `sum(total_amount_myr)` | `base_invoices`, `invoice_date` in range | Yes |
| `periodInvoiceCount` | `count(*)` | `base_invoices`, `invoice_date` in range | Yes |
| `totalCollected` | `sum(amount_applied_myr)` | `base_payment_apps`, `payment_date` in range | Yes |
| `outstandingAR` | `sum(total_amount_myr - paid_to_date)` where `status_code='O'` | `base_invoices` | **No** — as of today |
| `overdueInvoiceCount` / `overdueValue` | Open AND `due_date < current_date` AND balance `> 0.01` | `base_invoices` | **No** — as of today |
| `unallocatedPayments` | `sum(unallocated_amount)` | `base_payments`, `payment_date` in range | Yes |
| `dso` | `(Avg AR / periodInvoiced) * v_days`, where Avg AR = (Beginning AR + Ending AR) / 2, Beginning AR = `greatest(outstandingAR - periodInvoiced + totalCollected, 0)`, Ending AR = `outstandingAR`. `v_days` = period length, or 365 if no range selected. **Reconciled 2026-07** to match the classic average-AR DSO formula in `sap-data-architecture-plans/02-department-kpi-frameworks.md` — see that formula's derivation comment in `get_finance_dashboard_rpc.sql` for the accounting-identity caveat (no historical AR snapshot exists; Beginning AR is derived, not observed) | derived | Mixed (average-AR, but Ending AR is still an "as of today" snapshot, not "as of `p_end_date`") |
| `collectionRatePct` | `periodCollected / periodInvoiced * 100` | derived | Yes |
| `periodGrossProfit` (added 2026-07) | `sum(gross_profit_sanitized)` | `base_invoices`, `invoice_date` in range | Yes |
| `grossProfitMarginPct` (added 2026-07) | `periodGrossProfit / periodInvoiced * 100` | derived | Yes |
| `prevPeriodInvoicedRevenue` / `prevTotalCollected` / `prevPeriodGrossProfit` | Same formulas, over the immediately-preceding same-length window | derived | Yes (null if no date range given) |
| `periodBilled` / `periodBillCount` (added 2026-07) | `sum(total_amount_myr)` / `count(*)` | `base_bills`, `bill_date` in range | Yes |
| `totalPaid` (added 2026-07) | `sum(amount_applied_myr)` | `base_vendor_payment_apps`, `payment_date` in range | Yes |
| `outstandingAP` (added 2026-07) | `sum(total_amount_myr - paid_to_date)` where `status_code='O'` | `base_bills` | **No** — as of today |
| `overdueBillCount` / `overdueBillValue` (added 2026-07) | Open AND `due_date < current_date` AND balance `> 0.01` | `base_bills` | **No** — as of today |
| `unallocatedOutgoingPayments` (added 2026-07) | `sum(unallocated_amount)` | `base_vendor_payments`, `payment_date` in range | Yes |
| `dpo` (added 2026-07) | Same average-AP formula shape as `dso`: `(Avg AP / periodBilled) * v_days`, Avg AP = (Beginning AP + Ending AP)/2, Beginning AP = `greatest(outstandingAP - periodBilled + totalPaid, 0)`, Ending AP = `outstandingAP`. Launched with the average-AP methodology from day one — no point-in-time-first version ever shipped, unlike `dso`'s history | derived | Mixed (average-AP, Ending AP still "as of today") |
| `netArApPosition` (added 2026-07) | `outstandingAR - outstandingAP` | derived | **No** — as of today. A first, partial Working Capital signal ahead of full GL (Phase 2) — not a complete current-assets-vs-current-liabilities figure |
| `prevPeriodBilled` / `prevTotalPaid` (added 2026-07) | Same formulas, over the immediately-preceding same-length window | derived | Yes (null if no date range given) |

> **Why `periodInvoicedRevenue − totalCollected ≠ outstandingAR`, even with no date filter applied (confirmed 2026-07):** these three numbers are sourced from two structurally different places, not just different time windows. `outstandingAR` comes straight from `sap_invoices.paid_to_date` — SAP's own native, per-invoice running total (OINV.PaidToDate), with **no RCT2 join at all**. `totalCollected` comes from `base_payment_apps` (RCT2/`sap_payment_applications`), which can only attribute cash to `inv_type = 13` rows — on-account cash, credit memos, and other document types settle an invoice's `paid_to_date` in SAP without ever appearing in this sum. So `totalCollected` will generally **undercount** "true" cash collected relative to what `periodInvoicedRevenue − outstandingAR` implies — that gap is a real RCT2 attribution-coverage limit, not a bug in either individual figure. To quantify the gap on live data, compare SAP's own bookkeeping against the RCT2-derived figure directly:
>
> ```sql
> -- SAP's own "paid so far" across all active invoices (mirrors periodInvoicedRevenue - outstandingAR)
> select sum(total_amount_myr) as invoiced, sum(paid_to_date) as paid_per_sap,
>        sum(total_amount_myr - paid_to_date) as unpaid
> from sap_invoices where is_cancelled = 'N';
> -- RCT2-derived collected, same population, split by inv_type to see where the gap concentrates
> select pa.inv_type, count(*), sum(pa.amount_applied_myr)
> from sap_payment_applications pa join sap_payments p on pa.payment_ref = p.doc_entry
> where p.is_cancelled = 'N' group by pa.inv_type order by 3 desc;
> ```

**Chart datasets:**

| Key | Formula | Source | Period-bound? |
| --- | --- | --- | --- |
| `arAgingData` | Bucketed (`Current`/`1-30`/`31-60`/`61-90`/`90+` by `current_date - due_date`) count + `sum(total_amount_myr - paid_to_date)` | `base_invoices`, `status_code='O'`, balance `> 0.01` | **No** — always as of today, ignores date filter |
| `revenueTrendData` | Per month: `sum(total_amount_myr)` invoiced + `sum(amount_applied_myr)` collected, full-outer-joined by month | `base_invoices` / `base_payment_apps` | Yes |
| `topOverdueCustomersData` | Top 10 by outstanding, open + overdue | `base_invoices` | **No** — as of today |
| **`salesRepRevenueData`** | Per rep: `revenue_myr` = `sum(total_amount_myr)`; `gross_profit_myr` = `sum(gross_profit_sanitized)`; `gp_pct`; `collected_myr` = `sum(amount_applied_myr)` via `rep_collected_actuals` | `base_invoices` (`invoice_date` in range) joined `sap_sales_persons`; collected from `base_payment_apps` (`payment_date` in range) | Yes. **Invoice-based, not order-based** — see "Revenue-ownership split" below. `collected_myr` can be 0/absent for a rep with real invoice activity if none of their payment applications resolved through the `inv_type=13` join — check the live-vs-file deploy state before treating that as a data-coverage bug. |
| `topCustomersByRevenueData` | Top 10 by `sum(total_amount_myr)` | `base_invoices` | Yes |
| `unallocatedPaymentsData` | Drill-down for `unallocatedPayments`, top 10 by `unallocated_amount` | `base_payments` | **No** — as of today |
| `apAgingData` (real data since 2026-07) | Bucketed (same 5 buckets as `arAgingData`) count + `sum(total_amount_myr - paid_to_date)` | `base_bills`, `status_code='O'`, balance `> 0.01` | **No** — always as of today, ignores date filter. Was a `null` contract placeholder through 2026-06, pending AP-chain extraction (OPCH/PCH1, OVPM/VPM2) — the placeholder is gone now that data exists; no signature/key change was needed |
| `topOverdueVendorsData` (added 2026-07) | Top 10 by outstanding, open + overdue — AP mirror of `topOverdueCustomersData` | `base_bills` | **No** — as of today |
| `topVendorsBySpendData` (added 2026-07) | Top 10 by `sum(total_amount_myr)` — AP mirror of `topCustomersByRevenueData` | `base_bills` | Yes |
| `unallocatedOutgoingPaymentsData` (added 2026-07) | Drill-down for `unallocatedOutgoingPayments`, top 10 by `unallocated_amount` — AP mirror of `unallocatedPaymentsData` | `base_vendor_payments` | **No** — as of today |

**Revenue-ownership split (resolved 2026-07):** Finance's per-rep chart (`salesRepRevenueData`) used to sum `sap_sales_orders` (order-booked value) — a Sales Reports concern, not a Finance one, and the direct cause of Finance/Sales Reports per-rep revenue disagreeing. It's now invoice- and collection-based, matching Finance's own AR/cash mandate and matching Sales Reports' `rep_invoice_actuals` invoice figure by construction (same `base_invoices` shape, same `invoice_date` scoping) — the two dashboards now agree on invoiced revenue per rep for the same date range. See `DASHBOARD-ROADMAP.md` §5 and `get_sales_reports_dashboard` below.

**Target vs. as-built** — this app's Finance KPIs against `hyrax-data-platform/docs/sap-data-architecture-plans/02-department-kpi-frameworks.md`'s Finance section (the target model — that repo owns the SAP schema/KPI-formula decisions, this repo owns the as-built implementation, per that doc's own README governance note):

| Target KPI (data-platform doc) | As-built here | Status |
| --- | --- | --- |
| AR aging = `DocTotal − PaidToDate` on OINV, filtered `DocStatus='O'` | `outstandingAR` / `arAgingData` — exact same formula/filter, on the MYR-converted columns (`total_amount_myr`/`paid_to_date`) | ✅ Aligned |
| DSO = `(Avg AR / Total credit sales) × days` | `dso` = `(Avg AR / periodInvoiced) × days`, Avg AR derived from `outstandingAR` via the accounting identity (no historical AR snapshot exists) — **reconciled 2026-07** to the same average-AR methodology as this target formula | ✅ Aligned — see the formula derivation comment in `get_finance_dashboard_rpc.sql` for the one remaining approximation (Ending AR is an "as of today" snapshot, not "as of the selected period's end date") |
| Gross Profit Margin = `(Revenue − COGS) / Revenue` | `grossProfitMarginPct` = `periodGrossProfit / periodInvoiced × 100`, where `periodGrossProfit` sums SAP's own pre-computed `GrosProfit` per invoice line (added 2026-07) | ✅ Aligned in spirit — SAP already nets COGS out per line, so no separate COGS derivation was needed |
| Net Profit Margin, EBITDA margin, Current/Quick ratios, full Working Capital | Not built | ❌ Blocked — need GL extraction (`OACT`/`OJDT`/`JDT1`, Finance Expansion Phase 2, scoped not built). `netArApPosition` (added 2026-07) is a partial Working Capital preview, not the full figure |
| AP aging = `DocTotal − PaidToDate` on OPCH, filtered `DocStatus='O'` | `outstandingAP` / `apAgingData` (added 2026-07) — exact same formula/filter as the AR side, on `sap_vendor_bills` | ✅ Aligned |
| DPO = `(Avg AP / COGS) × days` | `dpo` (added 2026-07) — same average-AP shape as the reconciled `dso`, using `periodBilled` in place of COGS (mirrors how `dso` uses `periodInvoiced` in place of "Total credit sales") | ✅ Aligned in spirit — same caveat as `dso`: Ending AP is an "as of today" snapshot |
| DIO, Cash Conversion Cycle | Not built | ❌ Blocked — DIO needs inventory valuation (`OITW`, Finance Expansion Phase 3, scoped not built); CCC needs DIO |
| Budget variance | Not on Finance Reports | Lives instead on Sales Reports' `invoiceBudgetScorecardData` (Forecast 2 vs. `sales_budgets`) — a sales-side accountability view, not framed as a Finance KPI here |
| "RCT2/OITR joins only needed for payment-to-invoice drill-down" | `base_payment_apps` builds exactly this join for `totalCollected`/`salesRepRevenueData.collected_myr`; `base_vendor_payment_apps` (added 2026-07) builds the AP mirror for `totalPaid` | ✅ Built, but this is also where the `totalCollected`/`outstandingAR` (and, on the AP side, `totalPaid`/`outstandingAP`) reconciliation gap above comes from — the target doc's own caveat that this join is optional/drill-down-only is exactly why it's the less-authoritative of the two AR/AP-related figures |

---

## `get_sales_reports_dashboard`

Backs Sales Reports (`Reports.jsx`). Surfaces two forecasts side by side, deliberately never blended: Forecast 1 "Pipeline Target" (CRM self-reported) and Forecast 2 "Invoice Budget" (SAP system-of-record) — plus, as of 2026-07, the company's actual sales-side review: **PO (sales order) vs Invoice vs Budget variance, per rep.**

**Signature:**
```
get_sales_reports_dashboard(
  p_start_date   date default null,
  p_end_date     date default null,
  p_owner_id     uuid default null,               -- CRM lead owner (employees.id) -- Forecast 1 only
  p_product_type public.product_type default null
)
```
No `p_sales_rep_code` parameter exists — the per-rep datasets below always return every rep, unfiltered by SAP identity.

**Base CTEs:**
- `base_leads` — `sales_leads` + resolved `closed_date` (from `sales_leads_stage_history`'s last WON/LOST transition, falling back to `updated_at`), filtered by `p_owner_id`/`p_product_type`.
- `base_invoices` — `sap_invoices`, `is_cancelled = 'N'` only (no customer/rep/status filter params on this RPC).
- `base_orders` — `sap_sales_orders`, `is_cancelled = 'N'` only.
- `pipeline_target_math` — `sales_targets.target_revenue`, day-overlap-prorated against the selected date range, summed department-wide, filtered by `p_owner_id`.
- `budget_math` — `sales_budgets.budget_revenue`, same proration formula, per `sales_rep_code`.
- `rep_invoice_actuals` — per-`sales_rep_code` `sum(total_amount_myr)` from `base_invoices`, `invoice_date` in range.
- `rep_order_actuals` — per-`sales_rep_code` `sum(total_amount_myr)` from `base_orders`, `order_date` in range. Keyed by `sales_rep_code` (not `sales_rep_name` — avoids silently merging two reps who share a display name).
- `lead_kpis` — win rate, avg deal size, avg days to close, quote-to-win, median days to win — all from `base_leads`.

**`kpis`:**

| Field | Formula | Source | Period-bound? |
| --- | --- | --- | --- |
| `pipelineTargetRevenue` | Prorated `sales_targets`, dept-wide | `pipeline_target_math` | Yes |
| `pipelineWonRevenue` | `sum(actual_revenue)` where `stage='WON'`, `closed_date` in range | `base_leads` | Yes |
| `pipelineAttainmentPct` | `pipelineWonRevenue / pipelineTargetRevenue * 100` | derived | Yes |
| `orderBookValue` | `sum(total_amount_myr)`, `order_date` in range | `base_orders` | Yes |
| `winRatePct` / `avgDealSize` / `avgDaysToClose` | Same definitions as Leads Overview | `base_leads` | Yes |
| `quoteToWinConversionPct` / `medianDaysToWin` | Quoted-and-WON leads / quoted leads; median days quoted→WON | `base_leads` (`quotation_url is not null`) | Yes |

**Chart datasets:**

| Key | Formula | Source | Period-bound? |
| --- | --- | --- | --- |
| **`invoiceBudgetScorecardData`** | Per rep, full-outer-joined across `rep_order_actuals` / `rep_invoice_actuals` / `budget_math`: `order_value_myr`, `invoiced_revenue`, `budget_revenue`, `attainment_percentage` (`invoiced_revenue / budget_revenue * 100`), `po_vs_budget_variance_myr` (`order_value_myr - budget_revenue`), `po_vs_invoice_variance_myr` (`order_value_myr - invoiced_revenue` — positive = booked-but-not-yet-invoiced backlog, negative = invoiced more than booked this period, e.g. against orders booked earlier). Rep name/avatar joined via `employee_sales_rep_mapping` for display only. | `rep_order_actuals` + `rep_invoice_actuals` + `budget_math` | Yes (each leg respects the date range independently) |
| `orderBookData` | `{name, order_value_myr}` per rep, top 15 | `rep_order_actuals` (same numbers as the scorecard's `order_value_myr` — sourced from the same CTE so they can't drift) | Yes |
| `realizedVsPipelineData` | Per month: WON CRM `actual_revenue` vs. invoiced `total_amount_myr`, full-outer-joined by month — the two systems of record, explicitly not blended | `base_leads` / `base_invoices` | Yes |
| `grossProfitByRepData` | Per rep: `revenue_myr` = `sum(total_amount_myr)`; `gross_profit_myr` = `sum(gross_profit_sanitized)` (GP guard applied inline) | `base_invoices` joined `sap_sales_persons` | Yes |
| `productTypeData` / `sourceData` / `topClientsData` | `sum(actual_revenue)` where `stage='WON'`, grouped by product type / lead source / client | `base_leads` | Yes (WON-and-closed-in-range) |

**Why this RPC, not Finance, owns PO-vs-Invoice-vs-Budget:** per the company's own sales-review process, the only recurring sales-side analysis is comparing sales orders (PO), invoices, and budget to get a variance — a sales-forecasting/backlog question, not an AR/cash one. Finance's per-rep chart (above) covers invoiced revenue + cash collected instead. See `DASHBOARD-ROADMAP.md` §5.

---

## `get_sales_leads_dashboard`

Backs Sales Leads Overview (`LeadsOverview.jsx`) — Tier 2, daily rep-coaching cadence, CRM-only (no SAP tables involved at all).

**Signature:**
```
get_sales_leads_dashboard(
  p_owner_id     uuid default null,
  p_client_id    uuid default null,
  p_source_id    bigint default null,
  p_stage        sales_leads_stage default null,
  p_start_date   date default null,
  p_end_date     date default null,
  p_is_on_hold   boolean default null,
  p_is_cancelled boolean default null,
  p_product_type public.product_type default null
)
```

**Base CTEs:** `closing_dates` (last WON/LOST transition per lead from `sales_leads_stage_history`), `base_leads` (`sales_leads` + resolved `closed_date`, filtered by all the params above).

**`kpis`** (all from `base_leads`, most gated by `stage`/`is_cancelled`/date-range filters applied per-field via `filter (where ...)`):

| Field | Formula | Period-bound? |
| --- | --- | --- |
| `totalLeadsCreated` / `pipelineGenerated` | `count(*)` / `sum(expected_revenue)`, `created_at` in range | Yes |
| `wonLeads` / `wonRevenue` / `avgDealSize` | `count`/`sum`/`avg(actual_revenue)`, `stage='WON'`, `closed_date` in range | Yes |
| `lostLeads` / `lostRevenue` | `count`/`sum(expected_revenue)`, `stage='LOST' or is_cancelled`, `closed_date` in range | Yes |
| `winRate` | `WON / (WON + LOST)` — cancelled excluded from denominator | Yes |
| `activeLeads` / `activePipelineValue` | `count`/`sum(expected_revenue)`, not WON/LOST, not cancelled | **No** — real-time snapshot |
| `weightedPipelineValue` | `sum(expected_revenue * close_probability/100)`, active leads | **No** |
| `avgDaysToClose` | `avg(closed_date - created_at)`, WON in range | Yes |
| `forecastVariance` | `sum(actual_revenue) - sum(expected_revenue)`, WON in range | Yes |
| `fastTrackDeals` | Created AND won inside the same period | Yes |
| `negotiationPipeline` / `onHoldPipeline` | `sum(expected_revenue)` filtered by stage/hold flag, ignoring date range | **No** |
| `avgLostDealSize` / `avgLostCycle` / `cancelledLeads` | Same shape as the WON equivalents, for LOST/cancelled | Yes |
| `prevPipelineGenerated` / `prevWonRevenue` | Same formulas over the immediately-preceding window | Yes (null if no range given) |

**Chart datasets:** `stageData` (count/value by stage), `probabilityHealthData` (active leads bucketed by `close_probability`), `lossReasonData` (LOST leads by `lose_reason_id`), `trendData` (monthly created/won/lost from `sales_leads_stage_history`), `productTypeData` / `leadOwnerData` / `sourceData` / `topClientsData` (active-in-period + pipeline-generated + won + lost, grouped by product type / owner / source / client), `scorecardData` (per-owner WON actuals vs. prorated `sales_targets`, mirrored by Sales Reports' `pipeline_target_math`).

**Known gap:** `scorecardData`'s target proration ignores `p_owner_id` — filtering to one rep can still show other reps' target contribution leaking in (see `DASHBOARD-CURRENT-STATE.md` §4).

---

## `get_operations_dashboard`

Backs Operations Reports (`OperationsReports.jsx`) — fulfilment/backlog, no filters besides date range.

**Signature:**
```
get_operations_dashboard(
  p_start_date date default null,
  p_end_date   date default null
)
```

**Base CTEs:** `base_orders` (`sap_sales_orders`, active only), `base_order_lines` (`sap_sales_order_lines` carrying parent `order_date`), `base_deliveries` (`sap_deliveries`, active only), `delivery_vs_order` (deliveries matched to originating order via `sap_delivery_lines.base_entry = sap_sales_orders.doc_entry` where `base_type=17`), `full_chain` (order → delivery → invoice, collapsed to one row per document triple via `distinct` — an approximation when one order/delivery spans multiple invoices).

**`kpis`:**

| Field | Formula | Point-in-time? |
| --- | --- | --- |
| `openOrderCount` / `openOrderValue` | `count`/`sum(total_amount_myr)` where `status_code='O'` | **Yes** |
| `undeliveredUnits` | `sum(open_qty)` across all order lines | **Yes** |
| `fillRatePct` | `sum(delivered_qty)/sum(quantity)*100`, scoped by parent `order_date` | Period-bound |
| `onTimeVsRequestPct` | `count(actual_delivery_date <= requested_delivery_date) / count(*)` | Period-bound (by `actual_delivery_date`) |
| `onTimeVsPromisePct` | vs. the delivery doc's own `promised_delivery_date` | Period-bound |
| `avgOrderToShipDays` / `avgShipToInvoiceDays` / `avgOrderToInvoiceDays` | `avg(date - date)` across `full_chain`, scoped by `order_date` | Period-bound |

**Chart datasets:** `backlogAgingData` (0-30/31-60/61-90/90+ buckets by `current_date - order_date`, open orders only — **as of today**), `shipmentTrendData` (monthly delivery count), `topUndeliveredItemsData` (top 10 items by `open_qty`), `stockPositionData` (company-wide `stock_on_hand`/`committed_stock`/`on_order`/`available_qty`/`is_over_committed`, top 10 by over-commitment — **as of today**, no per-warehouse breakdown until `OITW` is extracted).

**Known gap:** the freshness banner watches `sap_sales_orders`/`sap_deliveries`/`sap_items` but not `sap_invoices`, despite `avgShipToInvoiceDays`/`avgOrderToInvoiceDays` depending on it (see `DASHBOARD-CURRENT-STATE.md` §7).

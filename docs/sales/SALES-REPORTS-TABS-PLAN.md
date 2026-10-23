# Sales Reports: tabs and metric layer, plan

Status: **FINAL END STATE BUILT** (2026-10-23, branch
`feat/sales-reports-final`) — see **§9, the frozen spec**. Changes to Sales
Reports from here must cite a rule in `docs/portal/DASHBOARD-CONVENTIONS.md`
§8. Step 5 (removing the legacy page) is still deferred, by decision.
Supersedes the single-page layout of `Reports.jsx` and the single
`get_sales_reports_dashboard` RPC.

## 1. Goals

1. **Split by audience.**
   - A Summary tab for weekly and monthly meetings.
   - Detail tabs for managers.
   - Daily work queues stay on the list pages (Leads, Orders), never on the report.
2. **One definition per measure.** A measure name means the same SQL on every tab
   and every page. A different calculation gets a different name.
3. **Every number provably consistent.**
   - The same measure on two tabs is computed by the same code.
   - Current and previous periods are computed by the same code.
   - Automated tests check both.
4. **Smaller, independent queries.**
   - Only the open tab's RPC runs.
   - One failing tab doesn't blank the others.

## 2. Page structure

```
Breadcrumbs · Last updated
PeriodSelector                     <- shared by every tab (URL: ?startDate&endDate)
SearchFilterBar (Salesperson · Export)   <- shared (URL: ?owner)
[ Summary | Revenue | Collections | Team | Forecast ]   <- tabs (URL path)
<Outlet />  -- the active tab
```

**Filters sit above the tabs.** They are global context: changing tab keeps the
period and the salesperson, and placing them above the tabs makes that clear.

**Tabs are URL-driven, as path segments**: `/app/sales/reports/summary`, `/revenue`,
`/collections`, `/team`, `/forecast`.

- Shareable ("look at Collections for September" is one link), and the browser back
  button and refresh both keep the tab.
- Path, not `?tab=`. `useDashboardQuery` sweeps every query parameter into the RPC
  filters and the React Query key. A `?tab` param would refetch the RPC and show up as
  a filter chip (the same reason `projectionFy` is local state today).
- Tab links carry `location.search`, so filters persist. `/reports` redirects to
  `summary` and keeps the query string.
- Same layout pattern as `LeadsPageLayout` (NavLink tabs + `<Outlet/>`).

**Export** captures the active tab:
- Title: `Sales Reports — <Tab>`.
- Subtitle: the period and the salesperson (already built).

**Forecast tab:**
- It is company-wide, so the salesperson filter is disabled there, with a note
  saying so.
- It follows the fiscal year of the selected period, replacing its own dropdown
  (decision D6).

## 3. Tab contents

The full reasoning for each tab is in the conversation draft. What each tab shows:

| Tab | Tiles | Charts / tables |
|---|---|---|
| **Summary** | Invoiced Revenue (vs budget) · Orders Booked · Payments Collected · Won (vs target) · *FY Outlook (own row, company-wide)* | Revenue vs Budget (monthly) · Budget gap bridge · Order-to-Cash YoY |
| **Pipeline** *(added 2026-10-22)* | Won vs Target · Win Rate · Lost · Open Pipeline (today) | Won vs Target (monthly) · Won by Product Type · Won by Lead Source · Top Clients · Lost by Reason · Open Pipeline by Stage (today) |
| **Orders** *(split from Revenue)* | Orders Booked · Book-to-Bill · Order Book (open, overdue, delivered not invoiced) | Orders Booked vs Invoiced (monthly) · Top Customers by Orders |
| **Invoicing** *(split from Revenue)* | Invoiced Revenue (vs budget) · Customer Concentration · Product Concentration (incl. top group) | Invoiced vs Budget (monthly) · Top Customers (invoiced + collected) · Top Products · Product Groups · Export vs Local |
| **Collections** | Payments Collected · Outstanding Receivables *(D2)* · Collection Rate *(D3)* | Invoiced vs Collected (monthly) · Top Payers · Top Outstanding |
| **Team** | — | Rep Funnel Scorecard (with flags on reps who need a check-in) · Revenue & GP by Rep · Collection Rate by Rep *(D3)* |
| **Forecast** | 4 projection tiles (unchanged) | 3 projection charts (unchanged) |

**Removed or moved:**
- **To the Orders page:** the Sales Order Fulfillment tile. That page already has
  Open Backlog, Overdue, Delivered Not Invoiced and Invoiced Not Fully Paid.
- **To Leads Overview:** the four pipeline charts. Check that the definitions match
  before deleting them.
- **To Leads Overview, as a target line:** Pipeline vs Target.
- **Removed:**
  - the O2C funnel (same numbers as the Summary tiles);
  - Sales Orders by Rep (already in the scorecard);
  - the 10 calculated but unused tile fields.

## 4. SQL architecture: three layers

```
Layer 1  DEFINITIONS   sales_*_facts views        one row = one business fact, canonical filters applied
Layer 2  SHARED LOGIC  report_period(), sales_report_scope(), sales_totals(), sales_monthly_series(), sales_rep_totals()
Layer 3  TAB RPCs      get_sales_summary / _revenue / _collections / _team  (+ existing get_sales_projections)
```

The tab RPCs never read `sap_*` / `sales_*` tables directly. They only read Layer 1
and call Layer 2. That is what makes "one definition" structural rather than a
convention someone has to remember.

### Layer 1: fact views (the definitions)

- Created `with (security_invoker = on)`, the repo's existing convention (see
  `projects_tasks_views.sql`, `sales_projection_series_view.sql`). They inherit the
  caller's table RLS, so exposing them through PostgREST grants nothing new.
- Supabase's default privileges grant every new object in `public` to `anon`, so
  each file also runs `revoke all ... from anon` explicitly.
- The RPCs keep their access guard (`sales_report_scope`), because several
  underlying tables have no RLS today.
- **Dates are converted to `date` once, here.** No more `"invoice_date"::date` in
  fifty places. The `nullif(x, '')` guard is applied before every cast.

| View | One row per | Canonical rule | Columns (main) |
|---|---|---|---|
| `sales_invoice_facts` | A/R invoice | `is_cancelled = 'N'` | `doc_entry, invoice_date, customer_code, customer_name`¹, `sales_rep_code, local_export_flag, invoiced_myr`², `gross_profit_myr` |
| `sales_invoice_line_facts` | invoice line | parent invoice in `sales_invoice_facts` | `doc_entry, invoice_date, customer_code, sales_rep_code, item_code, item_name, item_group_name, line_net_myr`² |
| `sales_order_facts` | sales order | `is_cancelled = 'N'` | `doc_entry, order_date, customer_code, sales_rep_code, booked_myr`² |
| `sales_collection_facts` | payment applied to an A/R invoice | receipt not cancelled · applied to a non-cancelled A/R invoice (`inv_type = 13`) · on-account cash excluded **by inner join** | `payment_doc_entry, payment_date, invoice_doc_entry, customer_code, sales_rep_code` (the invoice's) `, applied_myr` |
| `sales_receivable_facts` | open A/R invoice, now | outstanding > 0.01 | `doc_entry, invoice_date, customer_code, sales_rep_code, outstanding_myr` |
| `sales_won_lead_facts` | WON lead | stage WON · cancelled rule *(D5)* | `lead_id, closed_on`³, `owner_employee_id, account_key, account_name, product_type, lead_source, won_myr` |

¹ Customer name comes from `sap_customers`, falling back to the invoice's CardName,
so a customer can never split into two rows by spelling (audit D6).

² **Gross vs net is decision D4.** Until it is decided, header amounts stay gross
(DocTotalSy, as today) and line amounts are net. Line-based figures are labelled
"Product sales (before tax)" so the two are never shown under the same name.

³ `closed_on` = the lead's close timestamp converted to Malaysia time, then to a date
(`at time zone 'Asia/Kuala_Lumpur'`). This fixes the UTC-vs-local month-boundary
issue (audit D12) once, for every consumer. Needs D7 confirmed.

### Layer 2: shared logic (one copy of every rule)

**`report_period(p_start, p_end)`**. Returns `start, end, prev_start, prev_end,
trend_start, trend_end, has_period, comparison_is_partial`.
- These are the rules shipped today, moved out of the RPC:
  - unset dates = the full current month;
  - a whole-month range compares with the previous whole period;
  - while the period is in progress, it compares like-for-like (same days);
  - trend window = the period itself if it is a year or longer, otherwise its
    fiscal year.
- Not sales-specific, so Finance, HR and Operations reuse it later.

**`sales_report_scope(p_owner_id)`**. The access guard plus salesperson resolution.
- Raises `Access denied` for anyone outside SAL/MGM/superadmin.
- Forces a staff caller to their own data.
- Returns `owner_id, sales_rep_code, mapping_missing` (sentinel −1 when an owner has
  no SAP mapping).
- Today this logic is copy-pasted into each RPC; it becomes one function.

**`prorate_months(amount, month, from, to)`**. The day-overlap proration formula,
used by both budget and target.

**`sales_totals(scope, from, to)`**. One row:
- `invoiced, invoice_count, booked, order_count, ordering_customers`
- `collected, payment_count`⁴, `paying_customers`
- `won, won_count, budget, target`

Every tab calls it **twice: once for the period, once for the comparison window.**
A previous-period figure can no longer be defined differently from its current one
(the class of bug behind several audit findings).

⁴ `count(distinct payment_doc_entry)`: receipts, not application lines (audit D8).

**`sales_monthly_series(scope, from, to)`**. One row per month of the trend window:
- `invoiced, collected, booked, won`: actuals, `null` after the current month.
- `budget, target`: plans, `null` where there's no row.
- `is_partial, in_period`.

Every monthly chart on every tab reads this function.

**`sales_rep_totals(scope, from, to)`**. Per rep: `invoiced, booked, collected,
budget`, keyed by rep code, plus one explicit "Unassigned" row. Both the budget gap
bridge (Summary) and the scorecard (Team) read it, so they can't disagree.

`report_period`, `prorate_months`, `sales_totals`, `sales_monthly_series` and
`sales_rep_totals` are `language sql stable security invoker`, a single SELECT each.
Postgres can then inline them into the calling query instead of treating them as a
black box.

`sales_report_scope` is the exception: it is `plpgsql`, because it has to
`raise exception`. It runs once per request, so that costs nothing.

### Layer 3: tab RPCs

Each is `security invoker` and calls `sales_report_scope` first. Each returns:

```
{ meta: { period, comparisonWindow, trendWindow, mappingMissing },
  kpis: { ... },        -- <measure> and prev<Measure>; null = no data / no denominator, 0 = a real zero
  <dataset>: [ ... ] }
```

| RPC | `kpis` | Datasets |
|---|---|---|
| `get_sales_summary` | invoiced, prevInvoiced, budget, budgetAttainmentPct · booked, prevBooked, orderCount · collected, prevCollected, paymentCount · won, prevWon, target, targetAttainmentPct | `revenueVsBudget` (series), `budgetBridge` (rep totals), `orderToCashYoY` |
| `get_sales_pipeline` | won, prevWon, avgDeal, target, targetAttainmentPct · lost, winRatePct · openValue, weightedValue (today) | `wonVsTarget` (series), `wonByProductType`, `wonBySource`, `topClients`, `lostByReason`, `openByStage` |
| `get_sales_orders` | booked, prevBooked, orderCount, avgOrderValue, orderingCustomers · bookToBill · order book (open, overdue, delivered not invoiced) | `ordersVsInvoiced` (series), `topCustomers` (by booked) |
| `get_sales_invoicing` | invoiced, prevInvoiced, invoiceCount, avgInvoiceValue, budget, budgetAttainmentPct · customerTop5Pct, topCustomer · productTop5Pct, topProduct, topGroup | `invoicedVsBudget` (series), `topCustomers`, `topProducts`, `productGroups`, `exportLocal` |
| `get_sales_collections` | collected, prevCollected, paymentCount, payingCustomers · outstanding *(D2)* · collectionRatePct *(D3)* | `invoicedVsCollected` (series), `topPayers`, `topOutstanding` |
| `get_sales_team` | — | `scorecard` (rep totals + flags), `grossProfitByRep`, `collectionRateByRep` *(D3)* |
| `get_sales_projections` | unchanged | unchanged |

**The FY Outlook tile** on Summary reads `get_sales_projections`. It stays a separate
request on purpose: it runs on a different schedule, and a forecast outage must not
take the Summary down.

**Contract rules:**
- No field is returned unless a tab displays it (no dead outputs).
- Labels come from `meta`, never recomputed on the client.

## 5. Tests (what makes it trustworthy)

The portal has no test runner today. Add **Vitest + `@electric-sql/pglite`** as
dev dependencies, the same setup `echoes-hub` already uses (`tests/sql/`). A test
loads every sales SQL file in order against an in-process Postgres with stub `auth`
and seeded `sap_*` / `sales_*` rows. It asserts:

1. **Definitions.** Each fact view against hand-computed fixtures:
   - cancelled documents excluded;
   - on-account cash excluded;
   - customer-name variants don't split rows;
   - empty delivery dates don't crash.
2. **Cross-tab consistency** (the core guarantee). For the same period and salesperson:
   - Summary `invoiced` = Revenue `invoiced` = the sum of the series' in-period
     months = the sum of the Team scorecard rows (including Unassigned).
   - The same holds for `booked` and `collected`.
3. **Periods.** `report_period` across month ends, leap years, fiscal-year
   boundaries, in-progress periods and custom ranges (the cases already checked by
   hand this session).
4. **Scoping.**
   - A salesperson filter narrows every measure.
   - An unmapped salesperson returns zeros and `mappingMissing = true`.
   - A non-SAL caller gets `Access denied`.

The scripts used during the 2026-10-22 fixes (`trend_exec.mjs`, `cmp_check.mjs`) are
the starting point.

## 6. Rollout (the old page keeps working until the end)

1. **SQL layer.**
   - `sales_metric_facts_views.sql` (Layer 1) and `sales_metric_functions.sql`
     (Layer 2) in `supabase/sql_editor/`.
   - Add the test suite.
   - Run both files in Supabase. Nothing reads them yet.
2. **Reconcile.** `supabase/diagnostics/sales_reports_tabs_reconciliation.sql`
   compares `sales_totals` with the old RPC's KPIs over the last 12 months. Every
   difference must be one of the known, intended fixes (audit D2/D5/D6/D8/D12),
   listed in the file.
3. **Layout + Summary.**
   - `SalesReportsLayout` (period, filter bar, tabs, export) plus
     `get_sales_summary` and the Summary tab.
   - The old single page stays reachable as a temporary `/reports/legacy` tab.
4. **Revenue → Collections → Team → Forecast.** One per step, each with its RPC,
   tests and reconciliation.
5. **Retire.**
   - Delete `/reports/legacy`, `Reports.jsx`'s old body and
     `get_sales_reports_dashboard`.
   - Move the pipeline chart and Pipeline vs Target to Leads Overview.
   - Update `RPC-REFERENCE.md`, `DASHBOARD-CONVENTIONS.md` and
     `table_access_matrix.csv`.

**Later.**
- Finance's invoice and collection figures read the same fact views, so "Invoiced"
  and "Collected" agree across departments.
- Typed date columns upstream in `hyrax-data-platform`, so the views stop casting
  text to dates.

## 7. Decisions needed before step 1

| # | Decision | Default if unanswered |
|---|---|---|
| D1 | A Pipeline tab on Reports, or link to Leads Overview? | Link to Leads Overview |
| D2 | Outstanding Receivables tile on Collections? | Yes (the data already exists) |
| D3 | Collection Rate: keep (same period), replace with DSO, or "% of the period's invoices paid"? | Keep with a caveat; revisit |
| D4 | Is revenue measured including or excluding tax? Are credit notes netted? | Gross as today, line-based figures labelled before tax. **Ask Finance** |
| D5 | Is a WON lead later cancelled still won revenue? | Exclude (and change Leads Overview to match) after the check query |
| D6 | Forecast tab follows the page's fiscal year, dropping its own dropdown? | Yes |
| D7 | CRM close dates in Malaysia time? | Yes |

## 8. Build status (2026-10-22)

**Built (steps 1-4).**

| What | Where |
|---|---|
| Fact views (8: invoices, invoice lines, orders, order book, collections, receivables, leads, and won deals as the leads view's won rows). The planned budget/target views were dropped: they only renamed columns, so the functions read `sales_budgets` / `sales_targets` directly | `supabase/sql_editor/sales_metric_facts_views.sql` |
| Shared logic: `fiscal_year_start`, `report_period`, `prorate_months`, `sales_report_scope`, `sales_totals`, `sales_monthly_series`, `sales_rep_totals`, `sales_pipeline_totals`, `sales_order_book_totals`, `sales_report_meta` | `supabase/sql_editor/sales_metric_functions.sql` |
| Tab RPCs | `get_sales_summary_rpc.sql`, `get_sales_pipeline_rpc.sql`, `get_sales_orders_rpc.sql`, `get_sales_invoicing_rpc.sql`, `get_sales_collections_rpc.sql`, `get_sales_team_rpc.sql` |
| Reconciliation against the old RPC (read-only) | `supabase/diagnostics/sales_reports_tabs_reconciliation.sql` |
| Tests (Vitest + PGlite): definitions, cross-tab consistency, scoping, period rules | `tests/sql/sales_metrics.test.js`, `tests/unit/periodRange.test.js` |
| Layout + 7 tabs (Summary · Pipeline · Orders · Invoicing · Collections · Team · Forecast). Reports are for meetings (the story of a period); Leads Overview and the Orders page are for daily work and are unchanged | `src/pages/user/sales/reports/SalesReportsLayout.jsx`, `tabs/*` |
| Routes: `/sales/reports/{summary,revenue,collections,team,forecast}`; the old page at `/sales/reports-legacy` | `src/routes/SalesRoutes.jsx` |

**Left for step 5**, after the reconciliation shows only the expected differences:

- Delete `/sales/reports-legacy`, `Reports.jsx`, `config/overviewConfig.js` and `supabase/sql_editor/get_sales_reports_dashboard_rpc.sql` (drop the function in Supabase).
- Leads Overview:
  - add a target line to its revenue trend (replacing Pipeline vs Target);
  - adopt D5 (cancelled WON leads aren't won) by reading `sales_won_lead_facts`.
- Update `RPC-REFERENCE.md` (replace the `get_sales_reports_dashboard` section) and `table_access_matrix.csv`.
- Later: Finance's invoice and collection figures read the same fact views.

## 9. Final end state — frozen 2026-10-23

Built against the rules in `docs/portal/DASHBOARD-CONVENTIONS.md` §8 (R1–R12;
sources in `DASHBOARD-DESIGN-RESEARCH.md` §11). This is the layout Sales
Reports keeps; the next pages to get this treatment are the other
departments' reports. Decisions taken for this build:

- **Open balances are Today** (R3): Open Backlog, Outstanding, Overdue,
  Active Pipeline, Pending SAP Order Entry. Never narrowed to the period, no
  comparison. Before this, a picked period narrowed Open Backlog and
  Outstanding, and Open Backlog (Months) became meaningless.
- **Outstanding / Overdue use Finance's rule** (open in SAP, balance over
  RM0.01; overdue past due date; critical 90+ days): Sales' Outstanding now
  equals Finance → Invoices for the same rep. Sales' figure drops by the
  invoices that are closed in SAP but still show a balance.
- **Collection Rate retired** (D3 closed): aging, Overdue and DSO
  (Finance's formula, shared as `ar_dso`, trailing 90 days) replace it, and
  Top Customers on Invoicing no longer shows same-period payments.
- **Gross Margin is gated** on `supabase/diagnostics/sales_gross_profit_coverage.sql`
  (95%+ of Invoiced Revenue with a known GP over 12 months). Until it passes,
  `GROSS_MARGIN_RELEASED` in `reportFormat.js` stays `false` and Gross Margin
  and Gross Profit by Rep stay hidden. Basis: GP ÷ revenue before tax
  (VatSum and GrosProfit are both MYR at Hyrax).
- **AI Meeting Brief: built, then PARKED (not deployed, not rendered).**
  Code kept: `sales_report_briefs.sql` (not run), the
  `generate-sales-meeting-brief` edge function (not deployed),
  `MeetingBrief.jsx` + `fetchMeetingBrief.js` / `useMeetingBrief.js`
  (commented out of Summary). Before turning it on: make it reusable for
  every report (one `report_briefs` table keyed by report type; per report,
  the RPCs it reads, a figures builder and an access check) and feed it all
  six tabs' figures, not just the four headline RPCs. The secure design
  carries over: caller's token, RLS, figures stored with the brief. The old
  `generate-ai-summary` / `ai_dashboard_summaries` (Leads Overview) is
  untouched; its problems are logged in DASHBOARD-ROADMAP.
- **The legacy page stays** for now (step 5 still deferred).

| Tab | Sections, top to bottom (tiles [sub-metrics] · charts) |
| --- | --- |
| **Summary** | (**Meeting Brief** — parked, see above) · **Sales KPIs**: Pipeline Won · Sales Orders · Invoiced Revenue · Payments Collected · **Fiscal Year Progress**: Invoiced Revenue — FY to Date · Monthly Invoicing Needed · Projected Invoiced Revenue — FY [Not yet closed · 80% range] · This Month / selected month (both projections company-wide, hidden with a salesperson) · chart Cumulative Invoiced Revenue vs Budget · **Budget Variance**: Where the Budget Gap Came From (waterfall; hidden with a salesperson) · **Open Position (Today)**: Active Pipeline [Weighted · Pipeline Coverage] · Open Backlog [Orders · Open Backlog (Months)] · Outstanding Invoices [Overdue · Critically Overdue] · **Order-to-Cash — Year over Year** (Pipeline Won from the CRM's first FY) |
| **Pipeline** | **KPIs**: Pipeline Generated [Leads Created · SPLY] · Pipeline Won [Target · Avg. Deal Size · SPLY] · Win Rate [Won Leads · Total Lost Deals · Lost Revenue · Pipeline Cycle] · Active Pipeline — Today [Weighted · Active Leads · Pipeline Coverage] · **Trend**: Pipeline Won vs Target · **Active Pipeline (Today)**: Pending SAP Order Entry · Active Pipeline by Stage · **Breakdown**: by Product Type · by Lead Source · Top Clients · Lost Revenue by Reason |
| **Orders** | **KPIs**: Sales Orders [Order Count · Avg Order Value · Customers Ordering · SPLY] · Order-to-Invoice Ratio [Invoiced Revenue · Last 3 Months] · Open Backlog — Today [Orders · Open Backlog (Months)] · **Trend**: Sales Orders vs Invoiced Revenue · **Open Backlog (Today)**: Overdue Delivery · Delivered, Not Invoiced · **Breakdown**: Top Customers by Sales Orders |
| **Invoicing** | **KPIs**: Invoiced Revenue [Budget · Count · Avg · SPLY] · Gross Margin [Gross Profit · known-for % · SPLY] (gated) · Customer Concentration · Product Concentration · **Trend**: Invoiced Revenue vs Budget · **Breakdown**: Top Customers · Export / Local · Top Products · Product Groups (no Open Position: invoicing holds no stock) |
| **Collections** | **KPIs**: Payments Collected [Payments · Customers Paying · SPLY] · Outstanding Invoices — Today [Invoices · Customers · DSO] · Overdue — Today [Overdue Invoices · Critically Overdue] · **Trend**: Invoiced Revenue vs Payments Collected · **Receivables (Today)**: Overdue by Age · Top Overdue Invoices by Customer · **Breakdown**: Top Customers by Payments Collected |
| **Team** | **Rep Funnel Scorecard** (`RepFunnelScorecard.jsx`): per salesperson Pipeline Won vs Target + Win Rate → Sales Orders → Invoiced Revenue vs Budget → Payments Collected, today's open balances, flags (Below Pipeline Target, Below Budget, Delivered Not Invoiced, Critically Overdue) · **Rep Breakdown**: Invoiced Revenue & Gross Profit by Rep (gated) · Overdue by Rep |
| **Forecast** | unchanged: Projected Invoiced Revenue (tiles + fan chart) · Forecast Model Detail |

**New in the metric layer**: facts — `sales_receivable_facts` (Finance rule,
`due_date`, `days_past_due`), `sales_lead_facts` (`po_number`,
`pending_sap_order`), `sales_invoice_facts.invoiced_before_tax_myr`;
functions — `can_view_sales_reports`, `sales_owner_totals`,
`sales_pipeline_coverage`, `sales_run_rate`, `ar_dso`,
`sales_receivable_totals`, `sales_gross_margin`; changed —
`sales_pipeline_totals` (+ generated, pending SAP), `sales_order_book_totals`
(Today only, + backlog months). Tests: 66 SQL (incl. the briefs' RLS), 29 unit.

**R1–R12 walked per tab, 2026-10-23:** all pass. Fixed during the walk:
two R11 duplicates (Won Leads on both Pipeline Won and Win Rate; Sales
Orders repeated on the Order-to-Invoice tile). R4 clarified to "headline
period amounts" (ratios compare with the previous period only, in points or
×; shares need no comparison). Not a stage tab, so R2 doesn't apply to Team
or Forecast; Invoicing has no Open Position by R2's own exception.

**Supabase run order for this build**: `sales_metric_facts_views.sql` →
`sales_metric_functions.sql` → the six `get_sales_*_rpc.sql` → run the
gross-profit diagnostic and set `GROSS_MARGIN_RELEASED`. (Not now:
`sales_report_briefs.sql` and the `generate-sales-meeting-brief` deploy —
parked with the Meeting Brief.)


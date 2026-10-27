# Dashboard Conventions

Durable rules for how pages/dashboards are structured and built in this app. Rarely changes — if you're adding a new page or RPC, read this first. For what currently exists, see [`DASHBOARD-CURRENT-STATE.md`](./DASHBOARD-CURRENT-STATE.md); for what's planned next, see [`DASHBOARD-ROADMAP.md`](./DASHBOARD-ROADMAP.md).

---

## 1. Naming convention

- **List** = the table you work out of every day (a lead, an invoice, an asset). Operational, row-level, daily use.
- **Overview** = "how is _this one thing_ (Leads, Clients, Assets, Employees…) doing" — scoped to a single entity/submodule, used by the team running it and their direct manager, checked often.
- **Reports** = "how is _the whole department_ doing" — synthesizes across that module's entities, used by the department head at weekly/monthly cadence. Never just one entity's Overview relabeled.
- **Executive Summary** (doesn't exist yet) = "how is _the whole company_ doing" — synthesizes across departments, for leadership. `CLAUDE.md` names this as the long-term target. Treat it as the natural Tier 4, not something to retrofit into an existing Reports page.

### The 4-tier framework

BI/SaaS products almost universally separate reporting surfaces into four altitudes:

| Tier | Name                              | Audience / cadence                                              |
| ---- | --------------------------------- | --------------------------------------------------------------- |
| 0    | Record detail                     | Whoever owns that one record; as-needed                         |
| 1    | **List**                          | Individual contributor; daily, operational                      |
| 2    | **Entity/submodule Overview**     | The team running that entity + their line manager; daily/weekly |
| 3    | **Module/Departmental "Reports"** | Department manager/director; weekly/monthly                     |
| 4    | **Executive / cross-module**      | C-suite/leadership; monthly/quarterly                           |

> Stephen Few's operational/tactical/strategic taxonomy maps onto this:
>
> - Tiers 0–1 are operational (real-time, row-level, drill-heavy);
> - Tier 2 is tactical/analytical-but-single-domain (aggregated, filterable, never mixes unrelated entities);
> - Tiers 3–4 are strategic (low-refresh, headline-KPI, cross-entity synthesis, built to be read in five seconds).
>
> A submodule's Overview should never try to be a mini-Reports page, and a Reports page should never just be one submodule's Overview relabeled.

**A 5th shape sits outside this ladder on purpose: the Statement page** (Finance's Cash Flow, Balance Sheet, Income Statement). These are single-page financial statements, not an entity with a List — there's no row-level record to page through, so forcing a List/Overview split onto them would invent a tab with nothing to show. Don't try to retrofit one; a Statement page is a recognized, self-contained shape.

### 1a. Overview or Reports tab? One home per figure (added 2026-10-23)

Splitting a Reports page into tabs (Sales Reports was first) makes some tabs look like a submodule's Overview. They are not the same page, and neither replaces the other. They differ in audience (the team daily vs the manager monthly), in time rule (an Overview's ACTIONABLE backlog narrows to the period; a Reports tab's open balances are always Today, §8 R3), and often in access (Reports may be manager-only while the Overview is what staff see).

Give every figure ONE home, chosen by the question it answers:

- "What do I need to deal with today?" — items to chase, aging, on hold, unassigned → the **Overview** (or the List's KPI strip, §2a).
- "How did we do in the period, and what is open in total?" → the **Reports tab**. A Reports tab shows an open-balance TOTAL (and links to the list); it never carries the queue itself.
- A figure on both (e.g. Active Pipeline, Open Backlog, Outstanding) comes from **one shared SQL function**, so the two pages cannot disagree.

**First done: Sales Leads Overview (2026-10-23).** Kept — it carries the team's daily work (Pending SAP Order Entry, On Hold, Aging) and is what staff see, since Sales Reports is manager-only. Rebuilt to §8 on the shared metric layer, so its period figures equal Sales Reports' Pipeline tab; the List keeps the items to chase.

**When reviewing an existing Overview** (do it as part of building that department's Reports page, not as a separate cleanup):

| Question | If yes |
| --- | --- |
| Does it hold content people **act on** daily or weekly (overdue, on hold, unassigned, aging)? | Keep it |
| Do people who cannot open Reports depend on it? | Keep it |
| Is everything on it also on a Reports tab, at the same detail? | Remove it; link to the tab |
| Does it fail §2's test (no recurring KPIs of its own, or a stub list)? | Remove it; keep only the List's strip (§2a) |

---

## 2. When a submodule earns its own Overview + List

A submodule gets the `PageLayout` + tab-bar pattern (Overview _and_ List as siblings) only when **both** are true:

1. It's a distinct, analyzable entity/process with real recurring KPIs or trends a manager would want to check on its own, independent of the module's Reports page.
2. Its List is a genuinely active, maintained operational record set — not a stub, not a pass-through to somewhere else.

Don't migrate a page to the RPC-driven pattern below just to "match the others" — reserve it for pages with real cross-table joins and period-over-period deltas. Small, single-table entities (e.g. headcount-scale lists) are genuinely fine with client-side aggregation.

---

## 2a. When a List earns its own KPI-card strip (added 2026-09)

A List page doesn't need an Overview to still deserve a small `OverviewCards` strip of its own — the two are independent decisions. As of 2026-09, 14 pages carry a strip; only 7 have a full Overview.

**Add a strip when the list is an actively-worked operational queue with a real urgency/actionability dimension** — overdue, at-risk, aging, unassigned, awaiting-action, anomalous. The test: is "what in this list needs my attention right now" a meaningful daily question, distinct from "show me everything"? If yes, it earns a strip regardless of whether it also has an Overview.

**Every tile must resolve to a filter on that same list.** This is the load-bearing rule, not a nicety — confirmed true of all 14 existing tiles today (each `onClick` narrows the same list it sits above; see `Orders.jsx`/`overviewConfig.js` for the canonical shape). A number that can't be expressed as a filter on this list belongs on that entity's Overview or on the department's Reports page instead — don't stretch a strip to hold it.

**How a list's cards, period and tabs work together (added 2026-10-27; piloted on the Sales Leads list, then rolled out to every list):**

- **Each card's number is exactly what clicking it shows.** The cards follow the list's **period, panel filters and search** — the same rows the list returns — but **not the status tab**: the cards and the tabs are the same buckets, so a card that shrank with the tab would just read 0. Clicking a card switches to its tab and keeps everything else.
- **Definitions are the shared ones.** A card that also appears on an Overview or a Report (Active Pipeline, Pending SAP Order Entry, On Hold, Aging) uses the same SQL definition (for Sales: `sales_lead_facts`), so with no filters the list's cards equal the Overview's Today figures. The card RPC takes the list's own filter source (the view the list reads) and the shared measures — never its own re-derivation.
- **Period:** the same `PeriodSelector` as Reports and Overviews, with `defaultMode="all"` — lists open on **All time** (a work list shows everything until a period is picked) — and a `caption` naming the date it filters ("Leads created"). It replaces SearchFilterBar's `enableDateRange` presets and the FiscalYearFilterBar. Whole days are compared in Malaysia time (`+08:00` bounds in the list query, `created_on` in SQL), so rows and cards use the same days.
- **Status tabs:** `components/crud/statusTabs/StatusTabs` — the period picker's pill look inside `TabScroller` (‹ › arrows, centres the active tab), no icons, status colours kept. Exactly **one** tab is active (the most specific match), and every tab and card link is built with `tabLink()` (`functions/statusTabs.js`), which keeps the period, filters, search and sort, clears the tab-owned keys and the page. A card's helper filter that isn't a period (e.g. Aging's `createdBefore`) gets its own key — never the period's `startDate`/`endDate`.
- **Chips** (`ActiveFiltersBar`) show the panel filters only: the period picker and the tabs already show theirs.
- **Colours** follow §4: a plain figure is blue; "something to act on" uses `actionTileStatus`.

**Skip it** for flat reference/master data with no urgency dimension (a chart of accounts, a rep-mapping table, a document index). A strip there is decoration, not decision support — matches Odoo's own list-vs-dashboard split (plain lists for bulk review, dashboards reserved for modules with real analytical value).

**Cross-cutting rule for Overview-owning modules — mirror urgency tiles down to the List.** If an entity already has an Overview, check its own tiles against the same test above: any tile that's itself an urgency-filter (a "Pending Approvals," "Data Gaps," "Risk Assets," "Anomalies," "Unassigned" — anything answerable as a filter) belongs on the List too, not just the Overview. **Sales Leads is the reference implementation**: `LeadsManagement.jsx`'s (List) 4 tiles are deliberately "what needs action today," while `LeadsOverview.jsx`'s 5 tiles + charts are analytical — see that list page's own header comment. Don't build a second, unrelated tile set from scratch when evaluating a module that already has an Overview — start by asking which of its existing Overview tiles are secretly list filters already.

---

## 3. The shared Reports-page build pattern

> Every Tier-3 Reports page in this app follows one mold. Don't invent a new shape per department — clone an existing one.

**Backend:**

- A single Postgres RPC function that takes filter params (date range, rep, customer, status…), computes the previous period for deltas, builds CTEs over the near-raw `sap_*`/app tables, and returns **one** `json_build_object` containing a `kpis` object plus named chart-dataset arrays.
- Reference implementation to clone: [`supabase/sql_editor/get_finance_dashboard_rpc.sql`](../supabase/sql_editor/get_finance_dashboard_rpc.sql) — `base_invoices`/`base_orders`/`base_payments` CTEs, `kpi_totals`, then the `json_build_object`.

**Frontend:**

- `useDashboardQuery` → the JSON maps to `OverviewCards` (KPI tiles), `ChartCard` + Recharts renderers (bar/line/pie/horizontal-bar/stacked), `ExportActions` (PDF via `jspdf`), and optional `AISummary`/`GenerateAIButton` (Gemini-backed, writes/reads the shared `ai_dashboard_summaries` table — free to turn on for any dashboard).
- Page-composition template: `src/pages/user/finance/financialReports/FinancialReports.jsx`.

**Freshness banner:**

- A metadata service reads `sap_pipeline_state` (`last_run_at`, `last_run_status` per pipeline), takes the **most recent** `last_run_at` as "asOf", and flags `hasFailedPipeline` if any watched pipeline's last run errored. (Changed 2026-08 — was previously the _oldest_/weakest-link across all watched pipelines, a deliberate conservative design with its own past-incident precedent; the user explicitly chose the optimistic "most recent" display instead, accepting that the banner can now look fresher than the true worst-case staleness among watched pipelines. See `DASHBOARD-ROADMAP.md` §6 decision #10.)
- Template: `src/features/finance/reports/private/api/financeMetadataService.js`.
- Each new dashboard declares its own `*_PIPELINE_NAMES` list — make sure it actually lists every table the RPC depends on (a past miss: Operations' watched-pipeline list excluded `sap_invoices` despite two of its own KPIs depending on it).

**Scale note:**

- Everything computes live over near-raw tables. Total data volume is <100MB (~20k rows).
- There is **no dbt/materialized-mart layer and none is needed** — don't build one as a prerequisite for any dashboard here.

**Deploy mechanism:**

- RPCs are plain `.sql` files under `supabase/sql_editor/`, hand-pasted into the Supabase Studio SQL editor — no CLI/migrations wired up.
- Any RPC edit is a manual deploy step.

### Source-labeling convention (added 2026-07)

Every dashboard blends multiple tables that can sound interchangeable (a CRM self-reported figure vs. a manually-set quota vs. an audited SAP figure; an SAP subledger figure vs. a General Ledger figure). Confirmed concrete case that motivated this: Finance's "P&L Breakdown" chart has a "Revenue" bar sourced from the General Ledger (`gl_period_revenue`), while the headline "Revenue Invoiced" tile is sourced from the SAP invoice subledger (`periodInvoicedRevenue`) — two different numbers, previously indistinguishable by label alone.

**Rule: every tile sublabel, sub-metric label, and chart title/legend names its literal source table or layer — never a generic word that could mean more than one thing.** Apply this at build time, don't leave it to a tooltip alone (tooltips are supplementary, not the primary disambiguation).

Canonical tags in use today — extend this table rather than inventing new vocabulary per dashboard:

| Dashboard | Tag | Source | Nature |
|---|---|---|---|
| Sales Reports | *(none — "Pipeline" in the label already signals this)* | `sales_leads` | CRM, self-reported actual/open pipeline |
| Sales Reports | **Target** | `sales_targets` | Manually-set dept-wide quota (Supabase-native, not SAP) |
| Sales Reports | **Budget** | `sales_budgets` | Manually-set per-rep revenue budget (Supabase-native, not SAP) |
| Sales Reports | **Sales Order** | `sap_sales_orders` | SAP — booked, not yet necessarily billed |
| Sales Reports | **Invoice** | `sap_invoices` | SAP — billed |
| Sales Reports | **Payment** (added 2026-07) | `sap_payment_applications`/`sap_payments` | Cash actually applied — same RCT2 chain Finance uses, copied not re-derived |
| Sales Reports | **Invoice** (Top Products, added 2026-08) | `sap_invoice_lines` | Billed/actual, line-level — distinct from the Sales Order (booked) line tables and from `productTypeData`'s CRM `product_type` enum |
| Sales Reports | **Projection** (added 2026-10) | `v_sales_projection_ensemble` | Statistical, with an interval. The only forward figure on any dashboard that **nobody sets** — Target and Budget are both typed in by a human, this one is computed and carries measured accuracy. Company-wide only; does not respond to the salesperson filter |
| Finance Reports | **General Ledger (GL)** | `OACT`/`OJDT`/`JDT1` via `base_gl_lines` | True accounting postings |
| Finance Reports | **Invoice** | `sap_invoices` | AR subledger, invoice-line level |
| Finance Reports | **Bill** | `sap_vendor_bills` | AP subledger, bill-line level |
| Finance Reports | **Payment** | `sap_payment_applications`/receipts | Cash actually applied |

**"Client" vs. "Customer" — not interchangeable, but not exclusive to one dashboard either.** "Client" always means the CRM-native `clients` table (Sales Reports' "Top Clients" chart); "Customer" always means SAP's own `customer_code` on `sap_invoices` (Finance Reports' "Top Customers by Revenue," and — added 2026-07 — Sales Reports' own "Customer Concentration" tile/"Top Customers by Invoiced Revenue" chart, converted from CRM to SAP-invoiced per an explicit product decision that concentration risk belongs on audited billing data). Sales Reports now legitimately carries both words side by side, one per source table — don't let either word drift into meaning the same thing as the other, on either dashboard.

**A scenario is a peer only when it shares the measure's dimensions (added 2026-10-16).**

Actual, Plan/Budget and Forecast are *scenarios of one measure*, and IBCS — now an ISO standard — puts them together: same chart, same table, distinguished by fill. That is correct, and it has a condition that is easy to miss.

**They may sit together only where they slice the same way.** On Sales Reports, Actual and Budget both slice by salesperson and by date. The revenue forecast slices by date alone — `get_sales_projections` takes no owner parameter, and per-rep projections are permanently out of scope (splitting an already-lumpy series makes every sub-series lumpier; the top three invoices are ~31% of a typical month).

Three forecast rows were added to the Invoiced Revenue tile on 2026-10-15 and removed on 2026-10-16 for exactly this. With a salesperson selected the tile read **RM 4.2M actual, RM 8.1M budget, RM 32.8M company forecast** — a crisis that was not there. A label does not repair it, because a tile is a comparison frame: putting a figure in one is an invitation to compare it with its neighbours. It also breaks IBCS's own consistent-scaling rule.

> **The test:** before placing a figure beside another, ask whether it responds to *every* filter its neighbours respond to. If it responds to some and not others, it is not a peer — give it a region of its own that declares its scope, the way the Projections section declares "company-wide; ignores the salesperson and date filters".

This is the dimensional sibling of the source-labelling rule above. That one says *name what a number came from*; this one says *do not seat it next to numbers it cannot be compared with*.

Research and sources: `DASHBOARD-DESIGN-RESEARCH.md`.

**Stating an interval as a likelihood (added 2026-10-14).** A published interval may be written as a probability in plain words — `"80% likely RM 3.6M – RM 4.8M"` rather than an `"80% range"` sub-metric — **only where the coverage has actually been measured.** Sales Reports' projection qualifies: `v_sales_projection_ensemble`'s bands are sized from measured quantiles and verified at 77–82% coverage at every horizon, and the Forecast Reliability tile beside it publishes how often that has held.

The claim is unchanged either way — an 80% interval *is* an 80% likelihood — but the second wording is readable by someone who has never met a prediction interval, and the first is not. The constraint is the measurement, not the wording: **do not phrase an assumed or nominal interval as a likelihood.** A lognormal band nobody has back-tested stays an "80% range", because calling it "80% likely" asserts a frequency that has never been checked.

Two figures can legitimately disagree (e.g. GL revenue vs. invoice-subledger revenue, or a manually-set budget vs. an audited actual) — that's normal for these table pairings, not a bug to reconcile away. The fix is always to **label both sides so the difference is visible**, never to silently pick one or blend them.

### Watch-outs baked into every reference RPC — respect them in every new query

- SAP dates are stored as `text` — cast `"invoice_date"::date`.
- SAP flags are `'Y'`/`'N'` strings — filter `WHERE is_cancelled = 'N'`; **revenue must never blend cancelled docs**.
- The **RCT2 join trap**: join `sap_payment_applications.payment_ref` → `sap_payments.doc_entry`, never `receipt_number` (see `hyrax-data-platform/docs/data-dictionary.md`). Separately, the FK from a payment-application row to the _invoice_ it settles is `doc_entry` (confirmed — **not** `inv_entry`), filtered `WHERE inv_type = 13` — `doc_entry` is a polymorphic FK whose target depends on `inv_type`, so there's no database-level FK constraint for it; always apply the `inv_type = 13` filter yourself. See that same doc's "RCT2 → invoice link" section.
- SAP's `GrosProfit` has master-data defects — sanitize by nulling GP when `abs(gross_profit) > abs(total_amount_myr) * 5`; reuse that guard anywhere GP is summed.
- **Point-in-time vs. period-bound**: dashboards mix both. "As of today" snapshot metrics (AR aging, overdue customers, open backlog, stock position, active pipeline) deliberately ignore the date-range filter; period-bound metrics (revenue, collections, fill rate, on-time %) respect it. Comment this distinction explicitly at the field level in any new RPC.
- **Previous-period delta pattern**: compute a same-length immediately-preceding window (`v_prev_start_date`/`v_prev_end_date`) server-side, then a client-side `calcDelta(current, previous)` helper turns that into "↑/↓ X% vs last period." For where that delta actually gets displayed on the tile (headline `subvalue` vs. a sub-metric's own bracketed value), which metrics should skip a delta entirely, and how to pick each metric's default time window, see §4b.
- **Proration formula**: day-overlap proration of a monthly target/budget against an arbitrary date range — reuse the existing formula (`sales_targets`/`sales_budgets` proration) rather than re-deriving it, so multiple pages never silently drift apart on the same calculation.
- **Don't trust a SAP-mirror "identity/link" field until it's verified against live data.** Confirmed twice now: the RCT2→invoice FK above, and `sap_sales_persons.employee_id` (EmpID), which was assumed to bridge to Supabase `employees` but turned out empty in production and conceptually wrong (it's designed to reference SAP's own unused OHEM module, not a company employee code) — see `DASHBOARD-ROADMAP.md` §1.1 for the real bridge (`employee_sales_rep_mapping`, auto-populated per SAP rep via trigger). A field name or a doc's stated intent isn't evidence it's populated or means what it says — check.
- **`json_build_object` has a hard ~50-pair (100-argument) ceiling** — Postgres's `FUNC_MAX_ARGS`, not a config setting. Each key and value is a separate argument, so a `kpis` object that's grown additively across several build phases can hit it without anyone adding a huge single change — `get_finance_dashboard_rpc.sql` did, at 51 pairs/102 args, and had to be split into 4 calls merged via `jsonb ||` (see that file's header comment, fixing error `54023`). Split a `json_build_object` once it passes ~40 pairs, well before the ceiling, along whatever domain boundaries the object's own comments already suggest.
- **Don't sort by a bare enum column when order matters** (e.g. a pipeline-stage funnel) — `order by <enum_column>` sorts by the enum's `CREATE TYPE` declaration order, which may not be defined anywhere in this repo's own SQL and so can't be relied on to match a business sequence (Discovery → ... → Won/Lost). Use an explicit `case when value then N ... end` ordinal instead.
- **Null-guard multi-parameter date-range filters independently, not with one combined `is null` gate.** A pattern like `(p_start_date is null) or (created_at between p_start_date and p_end_date)` silently evaluates to `NULL` — and the row is dropped — the moment `p_start_date` is set but `p_end_date` is left null, because `p_end_date`-involving comparisons propagate `NULL` through the `OR`. This is reachable whenever a date-range filter UI renders two independent, uncoupled date inputs (the common case in this app). Guard each bound on its own: `(p_start_date is null or created_at >= p_start_date) and (p_end_date is null or created_at <= p_end_date + interval '1 day')`.

## 4. KPI Card Color & Fill Convention (added 2026-07)

Every KPI tile renders through one shared component, `OverviewCards` (`src/components/crud/overviewCards/OverviewCards.jsx`), which just applies whatever `variant` string a tile config hands it as a CSS class (`src/styles/index.scss`'s `.generalCard` block: `green/yellow/red/blueCard` = tint/outline, `green/yellow/red/blueCardFill` = solid fill). Before this convention, each dashboard's `overviewConfig.js` hand-picked a variant per tile with no shared rule — most were a hardcoded literal with no relationship to whether the underlying number was actually good or bad (a real bug: Finance Reports' Net Profit/Gross Profit/EBITDA/Working Capital were all static green/blue regardless of sign, so a loss or a working-capital deficit rendered exactly like a healthy period).

**Static vs. dynamic.** A tile is **dynamic** only if it has both (a) an inherent direction of "better" — `high-good`, `low-good`, or `sign-good` (crossing zero is a qualitatively different state, not just a smaller number) — and (b) a comparator computable today from fields already in `kpis` (a threshold, a companion percentage, a zero-line), never an invented number. Everything else is **static**:

- **Hero** — the page's one designated headline metric. Fixed blue, always filled, permanently — an identity marker, never a verdict.
- **Informational** — a fact with no computable comparator, or no real polarity at all. Fixed blue, tint only.

**Blue is reserved for hero/informational identity, never a verdict.** Green/yellow/red are a fixed, reserved severity ramp used only when a real evaluation is happening.

**Fill means "this tile outranks its neighbors right now."** Exactly two sources, mutually exclusive per tile: a fixed **hero**, or a dynamic metric's currently-active **worst severity tier**. A dynamic metric's "good" or "warning" reading is always tint; only its single worst/critical tier ever fills. A metric that develops real evaluative/sign risk surrenders hero-blue for the severity ramp — truthful severity outranks brand consistency (this is why Finance's Gross Profit/Net Profit/EBITDA/Working Capital moved off static blue/green once they were made dynamic).

**Status badge.** A dynamic tile also gets a small `{icon, label}` badge next to its value (`item.status` on the tile config, rendered by `OverviewCards.jsx`) — e.g. a warning-triangle + "Watch", an octagon + "Critical" — so severity is never color-alone.

**Shared utility:** `src/functions/statusVariant.js`'s `getStatusVariant(value, options)` computes `{ level, variant, statusIcon, statusLabel }` from a direction (`high-good`/`low-good`/`sign-good`/`target-band`), thresholds, and a tier count (2 or 3) — every dynamic tile calls this instead of hand-writing a ternary. Two techniques make several tiles possible without new RPC fields:

- **Borrowed-signal evaluation** — color driven by a sibling `kpis` field, not the tile's own displayed value (e.g. Overdue Risk's color comes from `overdueValue / outstandingAR`, not its own currency magnitude).
- **Delta-as-value** — the existing `calcDelta(...)` output fed in directly for metrics with no absolute target but a clear favorable direction of change (e.g. Departures).

Static-hero/informational tiles never call `getStatusVariant` — they keep hardcoding `"blueCardFill"`/`"blueCard"` directly.

**"Something to act on" tiles (added 2026-10-23).** A count whose good state is zero — Pending SAP Order Entry, On Hold, Aging, Overdue Delivery, Delivered Not Invoiced — is an evaluated tile (direction: low is good; comparator: zero), so "nothing waiting" is **green "On track"**, never blue, and anything waiting is **amber "Watch"** with its badge — a task, not a failure, so two tiers and a tint, no red. One helper for every page: `actionTileStatus(count)` in `src/functions/reportFormat.js` (Sales Reports, Leads Overview and the Leads list strip all use it, so the same figure is the same colour everywhere). Same for a pace check: `paceTileStatus(onPace)` (Monthly Invoicing Needed). A share with nothing to divide by because the base is zero (Overdue when nothing is outstanding) reads 0% — a good reading — not "no comparator".

**Numeric thresholds are documented estimates, not audited business targets.** Where a dynamic tile needed a real cutoff with no existing target/budget on the page (margin floors, DSO targets, attrition/absenteeism benchmarks, etc.), the threshold is commented inline in that tile's config as a starting point, tunable by Finance/HR/Sales without needing to touch the shared utility.

## 4a. Group related KPI tiles into fewer, denser cards (added 2026-09)

**The problem this fixes:** a dashboard that grew tile-by-tile over time ends up with many flat, same-weight tiles (Attendance Overview had 11) that read as a wall of numbers rather than a story someone can walk through in a department meeting.

**The rule:** before adding a new tile, ask whether it's really answering a _new_ question, or just a different angle on a question a neighboring tile already asks. If it's the latter, fold it in as a `metrics` sub-row instead of giving it its own card — `OverviewCards`' existing "headline = sum of its sub-metrics" pattern (already used by Attendance Anomalies and Employee Overview's "HR Actions Needed"/"Data Gaps" tiles before this convention was written down) is the mechanism, not a new one.

**How to decide what groups with what** — group by _the question being asked_, not by which RPC field happens to feed it:

- Two tiles that are really "different kinds of the same underlying concern" (e.g. Attendance's Pending Approvals + Leave Conflicts + Insufficient Half-Day Hours — all "records that need an HR decision") belong in one tile, one kind per sub-metric row. But watch the boundary of the concern itself: Attendance's own Missing Check-Outs/Incomplete Card Scans look similar at a glance but are "we don't have complete punch data", a genuinely different question from "a complete record needs a decision" — they were first grouped in with the reconciliation tile, then split back out into their own Data Quality tile once that distinction became clear.
- Two tiles that answer genuinely different questions (e.g. "how much time was logged" vs. "what time of day did it happen") stay separate, even if both are period-bound and both are about attendance — merging unrelated questions into one tile just relocates the clutter instead of removing it.
- A count-based sum-of-sub-metrics headline (`value = a + b + c`) works well when every sub-metric is a comparable "count of thing needing attention"; an averages-based tile (e.g. Hours Worked) keeps its own primary average as the headline and folds a _related_ total (Overtime) in as a sub-metric instead of trying to sum incompatible units.

Applied first to Attendance Overview (`src/pages/user/hr/attendanceManagement/overview/overviewConfig.js`), through several passes the same day (2026-09-25) as review surfaced sharper distinctions: 11 tiles → 7 (Attendance Rate; Needs Reconciliation; Punctuality; Hours Worked; Non-Working-Day Hours; Absenteeism Rate; Leave Days) → 8, the current end state (Attendance Rate — Absenteeism Rate folded in as its own sub-metrics, one color signal instead of two near-duplicate tiles; Needs Reconciliation — trimmed to Pending Approvals/Leave Conflicts/Insufficient Half-Day Hours/Absent; Average Check-In; Average Check-Out — Punctuality split back into two, since arriving late and leaving early are different behaviors a merged count hid; Data Quality — new, Missing Check-Outs + Incomplete Card Scans moved out of Needs Reconciliation; Hours Worked; Non-Working-Day Hours; Leave Days). Treat this as the reference example — not yet re-applied to Finance/Sales/other dashboards, but the pattern to reach for the next time one of them gets a tile-by-tile restructuring pass.

A related convention from the same pass, split each tile's default TIME WINDOW by what kind of question it answers, not by tile — fully worked out in **§4b** below, the reference to follow for any dashboard's next tile-by-tile restructuring.

## 4b. KPI tile anatomy & previous-period convention (added 2026-09-25)

Established while restructuring Attendance Overview's KPI cards, immediately after §4a's tile-grouping pass — this is the reference shape for every tile on every dashboard, not an Attendance-specific rule. Next dashboard to get a tile-by-tile pass (Sales/Finance/HR Reports) should follow this, the same way §3 already treats `get_finance_dashboard_rpc.sql` as the Reports-page build template.

### Tile anatomy, top to bottom

1. **Title** (`label`) — the one question this tile answers, in a few words.
2. **Subtitle** (`sublabel`) — states the tile's time window in plain words, so nobody has to guess whether a number resets monthly, reflects a manually-picked range, or is a live running total. Comes from a `periodLabel`/`actionableLabel` pair computed once per page load from whether a date filter is active:
   - **REGULAR** family: `"This Month"` (or whatever the default period is — see below) when unfiltered, `"This Period"` once a range is picked.
   - **ACTIONABLE** family: `"Current Backlog"` when unfiltered, `"This Period"` once a range is picked.
   Never leave a tile with no subtitle, and never use a bare word like "Total" that doesn't disclose the window.
3. **Main value** — the headline figure (a sum-of-sub-metrics per §4a, or a plain average/total).
4. **Main value's own previous-period delta** — the tile's `subvalue` slot (rendered by `OverviewCards` right on the headline), never a separate tile and never a separate sub-metric row. `deltaText(calcDelta(current, previous))` for a magnitude (`"↑ 9%"` / `"↓ 4%"`); for a time-of-day value, a minutes-based phrase instead (see below). Left blank when there's genuinely no meaningful comparison for that metric (see "When to skip a delta").
5. **Sub-metric rows** (`metrics[]`) — each folds its OWN delta into its OWN `value` string, in brackets: `"12 (↑9%)"`, via a small `valueWithDelta(value, delta)` helper. `OverviewCards`' sub-metric rows have no separate subvalue slot, so the bracket is the only place a sub-metric's own delta can live — never add a sibling "X vs Prev. Period" row for it.

### Two time-window families — decide per metric, not per tile

Every KPI belongs to exactly one family; a single tile's sub-metrics can legally mix both as long as each row's own label makes which family it's in unambiguous (rare — most tiles are one family throughout).

- **REGULAR** — descriptive: "how much/how many happened." Defaults to the full current default period (see below) when no date filter is picked, matches the exact selected range once one is.
- **ACTIONABLE** — decision-needed: "what's still outstanding right now." Defaults to the true current backlog, unbounded by date, when no date filter is picked — an old unresolved item must not disappear from view just because the date filter narrowed elsewhere on the page — and narrows to "originated within the selected period" once a range is picked.

Both families respect every non-date filter (department, employee, entity, location, etc.) with no exception; only the date dimension differs between them.

**On any page with the period selector the ACTIONABLE family is always Today (added 2026-10-23, §8 R3; extended the same day from Reports to Overviews).** "Originated within the selected period" answers a different question from "what is open", and `PeriodSelector` always has a period (the current month is just empty dates), so the rule above would flip meaning depending on which month is picked — Sales' Open Backlog (Months) shrank to nonsense the moment a past month was picked. Such pages show open balances as of today, labelled "Today" (`todayTile()`), with no comparison. Lists are the exception by design (2026-10-27): their period picker opens on **All time** (the whole backlog), and once a period is picked the list and its cards narrow to leads/records *created* in it — the list is a view of records, and §2a's rule (a card counts exactly what clicking it shows) governs it.

**Deciding which family a metric belongs to:** ask whether the number describes something that already happened in a period ("60 absences in August" — REGULAR), or something still open right now regardless of when it originated ("14 approvals still pending" — ACTIONABLE). A metric that could be framed either way is ACTIONABLE if the practical daily question is "what do I need to clear today" — the common case for anything HR/ops needs to action.

### Picking the REGULAR family's default period

"This Month" isn't universal — match whichever period the number is actually reviewed against:

- **Attendance/HR operational metrics** → This Month (reviewed monthly, resets monthly).
- **Sales quota/target-linked metrics** → This Quarter or This Fiscal Year, matching the cadence the underlying target/budget is itself set against — don't default to a period shorter than the target's own cadence, or the tile reads as permanently behind.
- **Finance statement-style metrics** → This Fiscal Year (statements are conventionally read within-fiscal-year, not calendar-month).

Whichever period is chosen, it must be a **full, complete period** (full month/quarter/year), never a to-date partial one — a to-date default also silently truncates its own previous-period comparison window (an 8-day September isn't a fair comparison against a full August). "Year to Date" stays available as its own explicit, separately-labeled option where it's genuinely the question being asked, never silently substituted for "This Year."

**Previous-period comparison (added 2026-10-22, Sales Reports first).** The selected period stays full, but a period that contains today only *has* data up to today, so comparing it with the whole previous period makes every delta look like a collapse early in the period (5 days of October against all 30 of September). While today is inside the selected period, compare like-for-like: the same number of days of the previous period (1–22 Oct vs 1–22 Sep), capped at that period's own end, and say so on the tile ("vs 1 Sep – 22 Sep 2026"). A completed period compares with the whole previous period ("vs last month"). A whole-month range steps back by whole months, never by day count. Reference: `get_sales_reports_dashboard_rpc.sql`'s `comparisonWindow`.

**Trend charts (added 2026-10-22).** A monthly trend chart shows the selected period itself when it is a year or longer, otherwise the fiscal year containing it, with the selected months shaded and the month in progress marked "*". Actual series stop after the current month (null, not zero); plan series (target, budget) continue. Never "all time" by default and never a single point. Reference: `trendWindow`/`trend_months` in the same RPC.

### When to skip the previous-period delta entirely

Not every number can honestly get one — showing a fabricated or misleading delta is worse than showing none:

- **ACTIONABLE/backlog metrics** — a live backlog has no meaningful "previous backlog" without a historical snapshot most schemas don't keep. Don't approximate one from a period-bound proxy ("originated in the previous period") — that measures a genuinely different fact (in-flow vs. current outstanding total), not the same number at an earlier time.
- **Time-of-day values** (average check-in/check-out, or any other clock-time average) — a percentage delta is meaningless for a time. Compute the same prior-window comparison as any other metric, but express the difference in minutes (`"5 min later"` / `"3 min earlier"`), not a ratio.
- **A count with no prior-period counterpart in the RPC yet** — don't invent one from unrelated data. Either add the missing `prev_*` aggregate (usually cheap once that tile's prior-period CTE already exists for its other metrics) or leave that one sub-metric delta-free until it's worth the SQL.

### Reference implementation

`get_attendance_dashboard_rpc.sql` (SQL side: `prev_period_rows`/`prev_employee_leave_rows` CTEs, one `prev_*` scalar per REGULAR metric — see `RPC-REFERENCE.md`'s own `get_attendance_dashboard` section) + `src/pages/user/hr/attendanceManagement/overview/overviewConfig.js` (frontend side: `calcDelta`, `deltaText`, `valueWithDelta`, `timeDeltaText` helpers, `periodLabel`/`actionableLabel` subtitles).

## 4c. Extending REGULAR/ACTIONABLE to charts, plus a third FIXED-WINDOW family (added 2026-09-25)

§4b's REGULAR/ACTIONABLE split isn't a KPI-tile-only rule — it applies one-to-one to every chart on the same page, decided by the same test: *does this chart describe something that already happened in a period (REGULAR), or something still outstanding right now regardless of when it originated (ACTIONABLE)?* A chart that revives an existing-but-unrendered dataset, or pairs with an existing KPI tile, must match that tile's own family exactly — reviving a dead REGULAR dataset to sit next to an ACTIONABLE tile (Attendance's `evidenceQualityBreakdownData` was originally built this way) produces a chart whose total silently disagrees with the KPI above it. Get a chart's own values from the SAME already-computed backlog-vs-period source its sibling KPI reads, not a fresh period-bound scan.

**A third family exists for charts only: FIXED-WINDOW** — a chart deliberately unbounded by the page's date filter, for a specific comparative purpose (typically seasonality) a period filter would defeat. Borrowed from Sales Reports' own trailing-12-months Bookings-vs-Invoiced trend, and now also used by Attendance Overview's "Attendance Rate — Trailing 12 Months." A FIXED-WINDOW chart still respects every non-date filter (department/employee/etc.) — only the date dimension is fixed.

**Subtitle vocabulary** — every chart's subtitle discloses its family in the same words its family's sibling KPI tiles already use, so a user who has learned to read a KPI sublabel reads a chart's subtitle for free:
- REGULAR: `"{what this measures}, {periodLabel}"` (`periodLabel` = `"This Month"`/whatever the module's own default period is, or `"This Period"` once filtered).
- ACTIONABLE: `"{what this measures}, {actionableLabel}"` (`actionableLabel` = `"Current Backlog"` or `"This Period"`).
- FIXED-WINDOW: an explicit, un-abbreviated phrase, e.g. `"Trailing 12 Months — not affected by the date filter"` — never left to a bare title with no window disclosed at all.

Title stays a bare description of what's plotted; the subtitle is the one place a chart's time-window family is always disclosed. `ChartCard` (`src/components/chartCard/ChartCard.jsx`) supports exactly one `title` + one `subtitle` string per chart — fold the family wording into that single string rather than requesting a new prop/badge slot for it.

## 4d. Chart-element drill-through (added 2026-09-25)

**The baseline, going forward for every dashboard, not just Attendance:** a chart's individual bars/slices/points should be clickable through to the specific filtered records they represent — not only the `ChartCard`-level "View All" link, which narrows to the whole chart's scope but not to one bar's category. First proven in Finance (`ChartOfAccountsOverview.jsx`/`FinancialReports.jsx`'s OpEx breakdown, 2026-09, via `HorizontalBarChartRenderer`'s `onBarClick` prop), then generalized across all four chart types during Attendance Overview's 2026-09-25 restructuring.

**Renderer contract, one per chart type** (`src/components/chartCard/`): each renderer stays dumb — it fires the raw Recharts datum up to the page via an optional prop, the page decides the destination and calls `navigate()`. No renderer performs navigation itself.
- **Bar/horizontal-bar**: `onBarClick(entry)` — ship-ready, already ubiquitous.
- **Pie**: `onSliceClick(entry)` — each `<Cell>` maps 1:1 to one datum, no multi-dimension ambiguity.
- **Line**: `onPointClick(payload, line)` — a clicked point represents a *bucketed period* (day/week/month), not a single filterable category. The filter it produces must be a `startDate`/`endDate` pair sized to that bucket, computed **server-side** (see below), not re-derived client-side from the bucket label.
- A **grouped/multi-series bar** (different filterable categories per series, e.g. an account broken out by quarter) needs a filter that combines both the row's category and the clicked series — more design work than the single-series case; don't assume the single-series contract generalizes for free.

**Where the filter comes from: the RPC, not the frontend.** Every clickable dataset's per-datum JSON object carries its own `filter` object, e.g. `{ name, value, filter: { department: 7 } }` — mirroring `OverviewCards`' existing `metrics[].filter`/`to` pattern. The click handler does `navigate(`${viewAllTo}${buildFilterUrl(entry.filter)}`)`, reusing `buildFilterUrl` (`src/functions/convertFilter.js`, already generic — any key/value object, not just a single value) unchanged. `filter` is `null` for a bucket with no sensible single filter (e.g. an "Unassigned"/"Unclassified" bucket) — leave that click a no-op rather than navigating to an unfiltered list. Building the filter server-side, not client-side, means a chart's click target can never disagree with what the bar/slice/point was actually aggregated from — this is why line-chart date ranges are computed in SQL from the same bucket boundary the point's value came from, not reconstructed from the displayed label afterward.

**The real per-chart blocker is identity, not the renderer.** `buildFilterUrl`/`ChartCard` are already generic enough for any chart; what actually gates whether a chart *can* be made clickable is whether its underlying query already carries a stable id (department/employee id, not just a display name) per row, and whether the target list page has a real, currently-selectable filter for that id. Two concrete fixes this pass needed before wiring clicks: `departmentAttendanceData`/`topAbsenteeismData`/`topOvertimeData` only grouped by display name, not id, so `department_id`/`employee_uuid` had to be added to their `GROUP BY`; and Attendance's Work Channel Mix chart needed a filter option (`evidenceSource`) added to `filterConfig.js` that the list page's query switch already technically supported but had never exposed as a selectable filter. **Don't guess a filter mapping you haven't verified** — Attendance's `leaveTypeBreakdownData` was deliberately left non-clickable this pass because the list page has no verified per-leave-type filter column; shipping a guessed filter key that silently matches zero rows is worse than no drill-through at all.

**A click has TWO legitimate destinations, not one (added 2026-10-16).** Everything above assumes a click navigates. Sales Reports' projection fan is the first chart here whose click sets **in-page state** instead: it selects a month, and that selection re-points a KPI tile and two sibling charts without leaving the page. Both are valid; what matters is that a renderer never decides which.

The two shapes differ only in what the page's handler returns:

- **Navigating** — the handler returns a URL and the renderer calls its `openChartClickThrough` wrapper. This is the default and every bar/pie/line renderer does it today.
- **Selecting** — the handler returns nothing and sets state. `VerticalMultiBarRenderer`'s raw `onBarClick(entry)` was the only precedent before `FanChartRenderer`. A renderer in this mode must also accept the current selection as a prop and show it, or the user cannot tell what they picked.

**ComposedChart sub-contract: `onMonthClick(name)` + `selectedMonth`, fired from the CHART, not a dot.** `LineChartRenderer` hangs clicks off `activeDot`, which does not generalise: in a fan chart both lines are `dot={false}` and the `actual` series is null across every future month, so dot-based clicks would leave the whole forward half dead. `ComposedChart`'s own `onClick` fires for the entire category column — including blank months, which a 12-month fiscal spine needs. Guard on `state?.activeLabel`: Recharts fires with no active label when the click lands outside the plot area, and an unguarded handler clears the selection on a stray click.

**The identity rule still binds, and bites harder here.** The chart hands up the X-axis *category string*. The page must map that back through its own data to a machine key the RPC supplied — `monthlyData` carries `periodMonth` beside `name` for exactly this. Parsing `'Mon YYYY'` back into a date client-side is the same mistake as re-deriving a line chart's date range from its bucket label, and it is forbidden for the same reason.

**Selection highlighting has no clean Recharts primitive on a point-scaled axis.** A `ReferenceArea` from a category to itself has zero width, and spanning to a neighbour highlights two. `FanChartRenderer` uses a thick translucent `ReferenceLine` — fixed pixels, so it is about one slot wide on a phone and a little narrow on a wide screen. Known compromise, not an oversight.

**Not yet done:** retrofitting this onto Sales/Finance's own Pie/Line charts (only their Bar charts have it today) is separate follow-up work, not a blocker for adopting this convention on new dashboards going forward.

## 5. Department module boundaries — no inter-departmental linking (added 2026-09)

**The rule:** a department's own pages must never navigate into another department's module. Most users are department-scoped (only MGM/superadmin cross department lines), so a cross-department link is either dead on arrival for the viewer, or — even when it happens to resolve — drops them into a UI shaped for someone else's job, not theirs.

**If department A needs something that conceptually belongs to department B:**
- If A already has read access (RLS) to the underlying table/view, A builds its **own** tailored view over it — mirroring §3's existing pattern (Sales/Finance/HR/Operations Reports are each a separately-coded RPC over shared tables, never one Reports page shared across two departments).
- If A does **not** yet have read access, that's a real gap to close with a small RLS policy addition — this codebase already has a repeated, low-risk precedent for exactly this (the `*_access_parity_fix.sql`/`*_access_fix.sql` migrations under `supabase/policies/`) — never a reason to link out to B's page instead.

**Corollary:** no page should gate on two different *operating* departments together (e.g. `departments={["FIN","OPS"]}`). The only legitimate second entry in any department gate is `MGM` (company-wide observer, not a second stakeholder). Two operating departments needing the same underlying data get two separate, tailored views, not one shared page.

**Case study (fixed 2026-09):** `InvoiceSidebar.jsx`'s "Matched Sales Order(s)" block used to render Sales' own `SalesOrderCard` with a click-through gated to Sales access — a Finance page reaching into Sales' module. Fixed by rendering `FulfillmentOrderCard` inline with no link at all: Finance's real need (see this order's status) doesn't require browsing Sales' own page, so no click-through and no new Finance-owned "orders" page were needed. Separately, `SAPCustomerCard` used to resolve to Sales' SAP Clients page even when rendered on Finance's own Invoice/Payment cards, for any MGM viewer — fixed by resolving the destination from the *current page's* own department context first, not just the viewer's access, so Finance's pages always resolve to Finance's own Business Partners page.

## 6. Detail sidebar section conventions (added 2026-09)

**Collapsible sections.** A detail sidebar with more than one secondary section (line items, matched/cross-referenced records) uses the same toggle pattern everywhere: a `<button className="salesOrderSidebarSectionToggle">` wrapping the section's label (`SectionHeader` or `MatchConnector`) plus a `CaretDownIcon`/`CaretUpIcon`, a `useState(false)` open flag, and an `AnimatePresence`/`motion.div` (`initial={{opacity:0,height:0,y:-5}}` → `animate={{opacity:1,height:"auto",y:0}}`) wrapping the content. The backing data hook takes a second `enabled` param (default `true`, so existing non-collapsible callers are unaffected) so the fetch is deferred until the section is actually expanded — see `useSalesOrderLines.js`'s own header comment for the canonical version, now mirrored by `useInvoiceLines`/`usePaymentsForInvoice`/`useBillLines`/`useVendorPaymentsForBill`/`usePaymentApplications`/`useVendorPaymentApplications`. First established in `SalesOrderSidebar.jsx`; now used by `InvoiceSidebar.jsx`, `BillSidebar.jsx`, `PaymentSidebar.jsx`, and `VendorPaymentSidebar.jsx`.

**The one deliberate exception**: a sidebar's *primary* cross-referenced section — the reason the record exists at all, not a secondary cross-reference — stays always expanded, no toggle. `InvoiceSidebar.jsx`'s "Matched Sales Order(s)" is the current example; its own "Matched Payment(s)" section right below it is a secondary cross-reference and does get the toggle treatment.

**Capped preview + true count.** A "preview a related list, then link to the full filtered list" section (Business Partner Sidebar's Invoices/Payments/Bills/Vendor Payments; Sales Order Sidebar's Matched Invoice(s)/Payment(s)) caps its own fetch to the 5 most relevant rows, but returns `{data, totalCount}` rather than a plain array — `totalCount` is the *true* match count (cheap to get: it's the length of an id-resolution step that already has to happen, not a second `count` query), and the "View all N" button/link always uses `totalCount`, never the capped preview array's own length, and always links through a real server-side filter (e.g. `salesOrderDocEntry`), never a doc-entry list built from the capped preview — otherwise "View all" would silently drop anything past the 5th row. See `fetchInvoicesForSalesOrder`'s/`fetchPaymentsForSalesOrder`'s own comments in `invoicesService.js`/`paymentsService.js` for the canonical version.

## 7. List-card conventions (added 2026-09)

> **Superseded on list pages by §9's two-line rows (2026-10-27).** The cards below stay as the summary block inside a record's sidebar (e.g. `LeadSidebar` reuses `LeadsList`) and on pages not yet migrated; 7a's Link + URL-driven sidebar and 7b's `nestedLink` rule still apply to rows.

### 7a. Card-is-a-Link + URL-driven sidebar

Every list page's card is now a `react-router` `Link` (or plain element when there's nowhere to go), not a `<button onClick>` — so a card is ctrl/cmd/middle-click-openable in a new tab, same as any other link. The shape, established across `InvoiceCard`/`SalesOrderCard`/`FulfillmentOrderCard`/`PaymentCard`/`BillCard`/`VendorPaymentCard` and brought to `LeadsList`/`AttendanceCard`/`LeaveCard` in 2026-09:

```jsx
const Wrapper = to ? Link : "div"; // or MotionLink/motion.div where the card animates
const wrapperProps = to ? { to, className: "..." } : { className: "..." };
return <Wrapper {...wrapperProps}>...</Wrapper>;
```

`to` is always parent-supplied, never hardcoded inside the card — the parent page builds it as `` `${row.id}?${searchParams.toString()}` `` (relative to the list route, preserving active filters). The detail sidebar's open/selected state is derived entirely from that URL param (`useParams()` for the id, `useMemo` to resolve the row from the already-loaded list or a fallback fetch-by-id for deep links, `sidebarOpen = !!selectedRow`) rather than local `useState` — the list route's own `:id` child route renders `element={null}`, since the parent page reads the param itself instead of routing to a separate component. This is why a card with no `to` (e.g. a read-only summary already inside its own open sidebar) correctly renders as a non-link `div` instead of omitting the click handler.

### 7b. Avoiding nested `<a>` — the `nestedLink` prop

A card that's itself a `Link` cannot legally nest another `<a>`/`Link` inside it (invalid HTML, breaks the inner element's click target, and duplicate/absorbed navigation). Four shared components that render their own link — `SAPCustomerCard`, `SAPVendorCard`, `EmployeeImage`, `LinkButton` — accept a `nestedLink` prop (default `true` = render as a real link/anchor; `false` = render identical content as a non-anchor element, `LinkButton` becoming a `<button>` that `stopPropagation()`s and opens the URL via `window.open`). **The rule, applied everywhere:** pass `nestedLink={!to}` down from the card's own `to` — content is only allowed to be an independently-clickable link when the card wrapping it is *not itself* a link. A card component that itself hosts one of these four (e.g. `LeadsList`) exposes its own `nestedLink` prop with the same default (`nestedLink = !to`) so it composes correctly whether it's rendered as the clickable list card or reused as a plain summary block inside an already-open sidebar (see `LeadSidebar.jsx`'s reuse of `LeadsList`).

### 7c. Shared 3-row card layout

`FulfillmentOrderCard`'s row rhythm — **status + dates** header, a **details** row (document #, PO/ref badge, customer/vendor badge, rep badge if any), then a bordered-off **figures** row (the money trail as plain text lines) — is the standard shape for every document-list card, not just Sales Orders. `documentCardHeader`/`documentCardStatus`/`documentCardDates`/`documentCardFigures` (nested under the shared `.salesOrderCard` class in `SalesOrderCard.scss`, neutrally named so non-order cards carrying them don't read as fulfillment-specific) are reused by `InvoiceCard`/`PaymentCard`/`BillCard`/`VendorPaymentCard`. `SalesOrderCard.jsx` itself keeps its older two-column header (`salesOrderCardHeader`/`HeaderLeft`/`HeaderDetails`) — it's only ever rendered by `LeadSidebar.jsx`'s matched-order mini-cards, not a list page, so it was deliberately left out of this migration.

### 7d. List-card figure-tone convention

Distinct from §4's KPI-tile `getStatusVariant` (which colors `OverviewCards` tiles): a list card's own **figures row** (Paid/Outstanding/Applied Payment/Gross Profit/Unallocated/etc.) is colored via `src/functions/documentFigureTone.js`, reused by `InvoiceCard`/`BillCard`/`PaymentCard`/`VendorPaymentCard`/`FulfillmentOrderCard`/`LeadsList` — same `.red`/`.green`/`.yellow`/`.blue` text-color utilities (`styles/fonts.scss`), different computation because a figure here is one plain number, not a KPI with a companion trend/threshold already in `kpis`:

- **`getAmountTone(actual, total)`** — green when fully (or over-) settled, yellow when partially, red when nothing yet. For "is this paid/invoiced/delivered" figures (Paid, Applied Payment, Invoiced, Delivered QTY) — a partial state is real and distinct from "not started," so this is always 3-tier, never a plain boolean.
- **`getBalanceTone(balance)`** — green at zero, red otherwise. For figures that should simply be zero (Outstanding, Unallocated) — no meaningful partial state, so binary is correct here, not a missing tier.
- **`getMarginTone(profit, total)`** — for Gross Profit specifically. `blue` when the figure is null or fails the existing "implausible GP" guard (`abs(gp) > abs(total) * 5`, the same SAP master-data-defect guard used everywhere else GP is shown/summed — see §3's watch-outs) — a "no reliable figure" state must never render as if it were evaluated. Otherwise: `green` at/above a **15% gross-margin threshold**, `yellow` for a thin-but-positive margin, `red` for a loss. **15% is deliberately below the ~50%+ "healthy margin" figure often quoted as a general rule of thumb** — oil & gas trading/distribution (this company's actual business) is a structurally thin-margin industry (commodity pricing, pass-through costs, heavy competition), commonly benchmarked in the 10-20% gross-margin range, not retail/software/manufacturing's much higher bands. Like §4's own documented thresholds, this is a documented estimate, tunable in `documentFigureTone.js` if Finance sets a different internal target.
- A figure with no natural "good/bad" reading (Total/Order, Expected Revenue) stays uncolored — coloring every number regardless of whether it has a real polarity would dilute the ones that do.

## 8. Reports storyline rules R1–R12 (added 2026-10-23)

The standard every Tier-3 Reports page is built and reviewed against. Written after Sales Reports was restructured several times, each pass argued from a code review instead of a fixed standard — so a change to a report now has to cite a rule here, and a rule changes only with new evidence (sources: `DASHBOARD-DESIGN-RESEARCH.md` §11). Reference implementation: Sales Reports (`src/pages/user/sales/reports/tabs/`, `reportFormat.js`), frozen as the end state in `docs/sales/SALES-REPORTS-TABS-PLAN.md`.

| # | Rule | Source |
| --- | --- | --- |
| R1 | **Answer first.** The first tab (Summary) is the overview layer; every tab opens with its headline tiles; detail and list pages come last. | Shneiderman; Minto |
| R2 | **Same four sections on every stage tab, in this order:** KPIs → Trend → Open Position (Today) → Breakdown. In the KPI row, period figures sit left and the Today tile sits rightmost. A stage that holds no open stock skips Open Position. | IBCS (same content, same place); monthly-review structure |
| R3 | **Period figures vs open balances.** A period figure (orders, invoices, payments, won deals) follows the period. An open balance (pipeline, backlog, receivables) is always Today — labelled "Today" (`todayTile()`), never narrowed to the period, with no previous-period or last-year comparison. | Kimball (snapshots are not additive over time); §4b |
| R4 | **Every headline period amount** (the money measures of the flow — Sales: Pipeline Generated, Pipeline Won, Sales Orders, Invoiced Revenue, Payments Collected, Gross Margin) shows vs plan (% + colour, when a plan exists), vs the previous period (arrow), and Same Period Last Year (sub-metric). Ratio tiles (win rate, order-to-invoice) show the previous period, in points or ×, not %. Share-of-total tiles (concentration) need none. | IBCS actual / plan / previous year; management pack |
| R5 | **Colour.** One fixed colour per measure on every tab (`MEASURE_COLORS` in `chartColors.js`); plans are dashed grey lines; green/amber/red only as a status or variance verdict; red as money colour only for lost / overdue. | IBCS (patterns for scenarios, colour to highlight) |
| R6 | **Chart types.** Time on the horizontal axis (lines/columns); categories as horizontal bars, largest first (ordinal scales like aging keep their order); a pie only for 2–5 parts of a whole, labelled with %. | IBCS time vs structure; pie guidance |
| R7 | **A variance gets a bridge** (waterfall: plan → drivers → actual, `BridgeChartRenderer`). | IBCS; executive-dashboard practice |
| R8 | **Year view:** fiscal year to date vs budget, plus the full-year outlook (actual + forecast) vs budget. | Management pack columns |
| R9 | **Every tile and chart states its window** (§4b/§4c) — the period, "Today", "FY to date", "Company-wide", "last 10 fiscal years". | §4b, §4c |
| R10 | **Never put figures side by side that follow different filters.** A company-wide figure is hidden (with a note) when a narrower filter is picked. | Research doc §3 |
| R11 | **Tile limits:** 4 per row (the grid width), at most 4 sub-metrics each, no figure shown twice in one row (§4a). | KPI-count studies; §4a |
| R12 | **Order follows the business flow**, leading indicators before lagging (Sales: Pipeline → Orders → Invoicing → Collections). | Leading / lagging indicator practice |
| R13 | **Every filter earns its place** (added 2026-10-23). A dashboard has one period selector (if it shows period figures) plus only the filters that pass all four tests: **(1) audience** — its audience routinely reviews or compares by that dimension in meetings or decisions (a manager reviewing each salesperson → Salesperson); **(2) every figure honours it** — targets, budgets and forecasts included; if one can't, that figure is hidden while the filter is on (R10) or the filter goes; **(3) not already a breakdown** — a dimension shown as a breakdown chart doesn't also get a filter (filtering collapses its own chart, and the chart already answers the question); **(4) not a work-queue attribute** — stage, status, on hold and the like are List filters: they sort work, they don't define a period's results. Each page states its filter set and the reason in its header comment and spec (table below). | Microsoft Power BI design guidance; "cut what wouldn't change a decision"; progressive disclosure (detail lives in the List) |

**Filter sets (R13)** — add a row when a page is built to these rules:

| Page | Filters | Why |
| --- | --- | --- |
| Sales Reports (all tabs) | Salesperson | Managers review each person's performance; budgets and targets exist per salesperson |
| Sales Leads Overview | Salesperson | As above. Client, source and product are its breakdown charts; stage / on hold / cancelled are Leads list filters |

**A refresh is always visible (added 2026-10-23).** Pages keep the previous figures on screen while new ones load (React Query `placeholderData`), so a period or filter change must show that it is working: `TabState`'s `isUpdating` dims the old figures and shows a floating "Updating figures…" pill (left out of PDF exports). Hooks return `isUpdating = isFetching && isPlaceholderData` (`useSalesReportTab`, `useSalesProjections`, `useLeadsOverview`).

**Shared building blocks** (moved out of the Sales pages 2026-10-23 so every department reuses them): `src/functions/reportFormat.js` (deltas, Same Period Last Year, `todayTile`, thresholds, bridge builder), `src/components/report/ReportSection.jsx` and `TabState.jsx`, `PeriodSelector`, `MEASURE_COLORS`, `BridgeChartRenderer`. The `.pdfOverviewSection` spacing lives in `styles/sections.scss`.

**Also binding on every Reports page:**

- **One definition per measure** in SQL — facts views (Layer 1) → shared functions (Layer 2) → thin tab RPCs (Layer 3), with a PGlite test that the same figure is identical on every tab (`tests/sql/sales_metrics.test.js` is the template).
- **Status thresholds live once** (`reportFormat.js`'s `*_THRESHOLDS`) and drive tile colours, scorecard colours and check-in flags alike: a person is flagged exactly when the same figure on a tile would read Critical.
- **A gated measure ships only after its data check** (Sales' Gross Margin: `GROSS_MARGIN_RELEASED` + `supabase/diagnostics/sales_gross_profit_coverage.sql`).
- **AI text is labelled, dated, kept with the figures it was written from, and exactly as private as the report** (design: Sales' Meeting Brief — `sales_report_briefs`, RLS on `can_view_sales_reports()`, caller's token, no service role; built but parked, to become a reusable `report_briefs`, see `DASHBOARD-ROADMAP.md` §2.1).

**Review checklist** (walk it per tab before calling a report done):

1. Does the tab open with its headline tiles, in R2's section order?
2. Is every tile's window stated, and every open balance a `todayTile`?
3. Does every headline period amount have plan / previous / last year, and every ratio its previous period (R4)?
4. Does each measure use its `MEASURE_COLORS` colour, plans dashed grey?
5. Is any figure in a row a duplicate of a neighbour, or filtered differently from it?
6. Does every tile and chart link to the list page with the same filters?
7. Does the SQL test prove the tab's figures equal the same figures elsewhere?
8. Does every filter pass R13's four tests, and is the filter set written down?
9. Does a period or filter change visibly show "Updating figures…"?

---

## 9. Page standard — reports, overviews and lists (added 2026-10-27)

How every Report, Overview and List page is laid out and behaves. Piloted on the Sales Leads list (`LeadsManagement.jsx`), then rolled out page by page using the table at the end. Reports' content rules are §8; a List's KPI cards are §2a.

### 9a. Page anatomy, top to bottom

| Report / Overview | List |
| --- | --- |
| 1. Tabs (Reports only) | 1. **Period picker** — the same one as Reports, centred (9b) |
| 2. **Period picker** (+ R13's filters) | 2. **Control row** (9b): Search · Filter · Export · **+ Add …** (right end) |
| 3. Export | 3. Filter chips (panel filters only) |
| 4. KPI tiles → Trend → Open Position → Breakdown (§8 R2) | 4. **KPI cards** (§2a) — they follow everything above them |
| | 5. **Status tabs** (`StatusTabs`) — they narrow the list only, not the cards |
| | 6. **Result bar**, sticky: "Showing 1–50 of 134" · Sort · page arrows. No second pager at the bottom (the bar stays in view) |
| | 7. **Rows** (9c) or a **table** (9d); the record opens in the right-hand sidebar |

No separate title row where the layout already names the page (`PageLayout`'s Overview | List bar does). The order is the rule "**controls above what they change**": the period, search and filters change the cards and the list, so they come first; the tabs change only the list, so they sit between the cards and the list.

### 9b. The period picker and the control row

The **period picker** is the same `PeriodSelector` on every page (Reports, Overviews, Lists) — two lines tall and centred, so it sits on its own above the control row rather than squeezed into it (a second, compact picker would break "same picker everywhere"). The **control row** (`SearchFilterBar`) holds the rest, always in this order, each piece shown **only when the page has it**:

| Piece | Shown when | Behaviour |
| --- | --- | --- |
| **Period** (`PeriodSelector`) | the page has a date to filter by | Replaces `enableDateRange`'s presets and two date boxes everywhere. A `caption` names the date it filters ("Leads created", "Invoice date"). Custom range is built in. |
| **Search** | the page has a search | The placeholder names what it searches ("Search invoice no. or customer…"). Applies on Enter. |
| **Filter** | the page has at least one panel filter | Round funnel button with a count badge when filters are on. **Hidden when the page has none** (until now 9 pages showed a Filter button opening an empty panel). The panel opens directly under the row. |
| **Export** | the page has an export | Round download button; the menu item says what it exports ("CSV · 134 leads"). |
| **+ Add** (`onAdd`, `addLabel`) | the page can create records | A filled round **+** in the primary colour (Echoes Hub's add button), at the right end. |

**Look:** the search box is a pill (999px radius, 40px tall, magnifier inside, its own clear ×) and the buttons are 40px circles with the period picker's thin outline — so the row takes one line even on a phone. Icon-only is acceptable here because search, funnel, download and + are among the most widely recognised icons; every one still has a tooltip and an `aria-label`.

**The Filter panel never repeats a status tab's keys** (stage, on hold, cancelled, pending…): the tabs own those, and offering both let them fight over the same URL key. The chips likewise show panel filters only.

On a phone the row wraps; the result bar under the list's tabs carries the count, **Sort** and the page arrows (`PageResult`'s `pageSize` + children).

**Default period, by page type:**

| Page type | Opens on |
| --- | --- |
| Reports, Overviews | This month (`defaultMode="month"`, §8) |
| Work lists (records you look up: leads, orders, invoices, payments, bills) | **All time** (`defaultMode="all"`) |
| Lists that grow every day (journal entries, notifications, run logs, my attendance) | This month |
| Attendance (team / HR) | **Today** — needs a Day mode in `PeriodSelector` (‹ › step one day); to build when attendance is migrated |
| Master data (clients, employees, assets, projects, users) | No period |

### 9c. Two-line rows (`components/crud/listRow/ListRow`)

The default for any list where people **look for one record and open it**. ~52 px per record, ~3× more per screen than the old cards; 50 per page.

```text
(face)  Line 1   what the record is                       the one figure the page counts   [buttons]
        Line 2   [Status ▮▮▮▯▯] · who · what · when                              [warning chips]
```

- **Face(s)** (`people`): the owner's photo (32 px), or up to 3 overlapping members and "+N" (projects, tasks). A column of faces is how people glance "who's who"; the name is also on line 2.
- **Line 1:** the record's name / number (truncates) and **one** figure, right-aligned, tabular — the figure the page's cards count (Leads: expected revenue, or won revenue once won; Invoices: outstanding). Its tooltip names it.
- **Line 2, always in this order:** the status chip first (with a mini step tracker when the record moves through stages — a lead's 4 stages + outcome, an order's Ordered → Delivered → Invoiced → Paid), then who, what, when, separated by "·"; warning chips last. **Empty values are left out**, not shown as "—".
- **Buttons** (`actions`, optional): small icon + count buttons on the right (a project's Members / Documents). They sit **outside** the row's link, so pressing one never opens the record.
- The whole row is one `Link` (§7a); the open record's row is highlighted. The full detail (stage tracker, figures grid, documents) lives in the sidebar — normal practice: CRMs show the stage path on the record page and the stage as a label in list views.
- Each list writes one small row component (`LeadRow`) that decides what goes on each line; `ListRow` only lays it out. The old card stays available behind one flag (`USE_OLD_CARDS` in `LeadsManagement.jsx`).

### 9d. When a table instead

Use `DataTable` when people **compare numbers across columns or edit cells inline**: Chart of Accounts, Account Ledger, Journal Entries, Payroll Export, Sales Targets, Sales Budgets, Sales Rep Mapping, Leave Types, Attendance Settings. A table gets sortable headers (`sortable` columns) instead of `SortBar`.

### 9e. Loading is always visible

- **First load:** spinner.
- **Any later change** (period, filter, search, sort, tab, page): the previous figures and rows **stay on screen**, dimmed, under a floating pill — "Updating figures…" over the KPI cards, "Updating leads…" over the rows (`TabState`'s `isUpdating` / `updatingLabel`). A quiet background refresh (after a save) shows nothing.
- `usePaginatedQuery` keeps the previous page with `placeholderData: keepPreviousData` and returns `isPlaceholderData`; a page's "updating" flag is `isFetching && isPlaceholderData`. (Its old `keepPreviousData: true` was TanStack v4's option and was ignored, so every change blanked the list.) List KPI hooks use `placeholderData: (previous) => previous` the same way.

### 9f. Every page, and what it gets

R = rows, T = table, — = not a list. Period default per 9b. ✅ = done.

| Page | Type | Period (date filtered) | Search | Rows / table | Cards | Tabs |
| --- | --- | --- | --- | --- | --- | --- |
| Sales Leads ✅ | List | All time (created) | ✓ | R | ✓ | ✓ |
| Sales Orders | List | All time (order date) | ✓ | R (+ fulfilment tracker) | ✓ | ✓ |
| Clients, SAP Clients | List | — | ✓ | R | | |
| Sales Targets, Sales Budgets, Rep Mapping | List | — | | T | | |
| Sales Leads Overview ✅, Sales Reports ✅ | Overview / Report | This month | | — | ✓ | |
| Invoices, Payments, Bills, Vendor Payments | List | All time (document date) | ✓ | R | ✓ | |
| Business Partners | List | — | ✓ | R | | |
| Chart of Accounts | List | — | ✓ | T (tree) | | |
| Account Ledger, Journal Entries | List | This month (posting date) | | T | | |
| Finance Reports, Income Statement, Cash Flow, Chart of Accounts Overview, Category Detail | Report / Overview | This month | | — | | |
| Employee Management, Employees directory | List | — | ✓ | R (face) | | ✓ |
| Leave Management | List | All time (leave date) | ✓ | R (face) | | |
| Lifecycle cases | List | — | ✓ | R (face) | ✓ | ✓ |
| Attendance Management, Team Attendance | List | **Today** (Day mode) | ✓ | R (face) | ✓ | ✓ |
| My Attendance | List | This month | ✓ | R | ✓ | ✓ |
| Payroll Export | List | Month (payroll month) | | T | ✓ | |
| Leave Types, Attendance Settings | Settings | — | ✓ | T | | |
| HR Reports, Attendance / Team / My Attendance Overview, Employee Overview | Report / Overview | This month | | — | ✓ | |
| IT Assets | List | — | ✓ | R | | |
| Projects, Tasks, Documents (+ the project's Tasks / Documents tabs) | List | — | ✓ | R (faces + Members / Documents buttons) | ✓ | ✓ |
| Users | List | — | ✓ | R (face) | ✓ | |
| Notifications | List | This month | ✓ | R | | |
| Pipeline Status (run log) | List | This month | ✓ | R | ✓ | |
| Operations Reports | Report | This month | | — | ✓ | |
| Organization Chart | Chart | — | | — | | |

---

## 10. Page and data specs — decide before you build (added 2026-10-27)

**No Report, Overview or List page is built or changed until its spec is written here:** the exact tables, views and functions it reads, which definitions it uses, and its filters, sorting, period, tabs and cards. Written because Sales Leads alone had grown three closed-date rules, two Pending SAP rules, and list filters that re-derived "won", "lost" and "active" in JavaScript — each built for one page, each a little different.

### 10a. The data layer — one shape for every entity

| Layer | What it holds | Sales Leads |
| --- | --- | --- |
| **Table** | the record; the app writes here | `sales_leads` |
| History, lookups | supporting tables | `sales_leads_stage_history` (trigger-written), `lead_source_types`, `sales_leads_lose_reasons`, `clients`, `sap_customers` |
| **Facts view** | **every rule, defined once**: outcome, dates in Malaysia time, flags, money | `sales_lead_facts` |
| **List view** | the table's columns + the facts view's rule columns — what the List, its cards, the CSV and the record sidebar read | `sales_leads_list` |
| Shared functions | measures over the facts view (totals, series, per person) | `sales_totals`, `sales_monthly_series`, `sales_owner_totals`, `sales_pipeline_totals`, `sales_pipeline_coverage` |
| **Page functions** | one per page or tab, thin: the List's cards read the list view; Overviews and Reports read the shared functions | `get_leads_overview`, `get_sales_leads_dashboard`, `get_sales_pipeline` / `_summary` / `_team` |

**Binding:**

1. **A rule exists in exactly one place** — the facts view. No second copy in another view, an RPC's own CTE, or a front-end filter that combines columns (the old `activePipelineOnly` = "stage not WON/LOST and not cancelled").
2. **Every filter key is one list-view column** (`outcome=lost`, `pendingSapOrder=true`, `closedDateFrom` → `closed_on`), so a list filter and a figure can't disagree.
3. **Every view is `security_invoker`**, so the table's RLS applies everywhere the rows appear.
4. **Dates are compared as Malaysia dates** (`created_on`, `closed_on`), never as UTC timestamps.
5. A new object needs a row in its entity's spec, below, before it is created; an object no spec names is a candidate for removal.

### 10b. The page spec — fill in for every page

| Field | Says |
| --- | --- |
| Reads | the page function(s) or view, nothing else |
| Definitions | which facts-view columns or shared functions its figures use |
| Period | which date it filters, and its default (§9b) |
| Filters | the panel filters (R13's four tests for Reports and Overviews) |
| Tabs | each tab as list-view column tests |
| Sort | options and the default |
| Cards | each card, its definition, and the tab it opens (§2a) |

### 10c. Sales Leads — data spec (done 2026-10-27)

**Objects:**

| Object | Verdict | Why |
| --- | --- | --- |
| `sales_leads`, `sales_leads_stage_history` (+ `log_sales_leads_stage_change` trigger) | keep | the record and its stage history |
| `sales_lead_facts` | keep — **the one definition** | outcome (cancelled = lost, D5), `created_on` / `closed_on` (Malaysia), `pending_sap_order` (won, not cancelled), `expected_myr`, `won_myr` |
| `sales_won_lead_facts` | keep | only `sales_lead_facts where outcome = 'won'` — a filter, not a second rule |
| `sales_leads_list` | **new** | replaces `sales_leads_with_closed_date`; its rule columns come from `sales_lead_facts` |
| `sales_leads_with_closed_date` | **removed** (`retire_sales_legacy_objects.sql`, run after the frontend is live) | defined the closed date (UTC) and Pending SAP (cancelled included) a second time; had no `security_invoker` |
| `get_leads_overview` | changed | reads `sales_leads_list` only; closed window on `closed_on` |
| `get_sales_leads_dashboard`, `get_sales_pipeline` / `_summary` / `_team`, the shared functions | keep | already on the facts view |
| `get_sales_reports_dashboard` + `/sales/reports-legacy` (`Reports.jsx`, its config and fetch) + `sales_reports_tabs_reconciliation.sql` | **removed** 2026-10-27 (page and files deleted; function dropped by `retire_sales_legacy_objects.sql`) | its own copies of the closed date and Won — Won counted cancelled deals, against D5 |
| `get_sales_targets_prorated` | **removed** (`retire_sales_legacy_objects.sql`) | existed only in the live database; nothing called it |
| `sales_quotations`, `sales_quotation_items` | **keep for now** (decision 2026-10-27) | nothing reads them yet; for the future Quotations page |

**Leads list page:**

| Field | Spec |
| --- | --- |
| Reads | `sales_leads_list` (rows, CSV, sidebar), `get_leads_overview` (cards) |
| Period | created date (`created_on`), All time by default |
| Filters | Salesperson, Client (Prospect), SAP Customer, Lead Source, Product Type, Lose Reason, Has quotation |
| Tabs | All · Active (`outcome=open`) · Discovery / Sample Test / Proposal / Negotiation (open, that stage, not on hold) · On Hold (open + on hold) · Won (`outcome=won`) · Pending SAP (`pending_sap_order`) · Lost (`outcome=lost`, **cancelled included**, as on the Overview and Reports) · Cancelled. "Won or lost" (`outcome=closed`, from the Win Rate links) appears only while active |
| Sort | Updated (default, newest first), Created, Expected revenue, Close probability, Stage. "Owner" removed — it sorted by the owner's id |
| Cards | Active Pipeline → Active · Pending SAP → Pending SAP · On Hold → On Hold · Aging 30+ Days → Active + `createdBefore` |

**Links into the list** (Leads Overview, Sales Reports Pipeline tab, legacy page) use the same keys: `outcome`, `pendingSapOrder`, `onHold`, `closedDateFrom` / `closedDateTo`, `createdBefore`. The old `activePipelineOnly`, `lostOrCancelled`, `closedOnly` and `stage=WON&cancelled=false` keys are gone.

**Leads Overview:** reads `get_sales_leads_dashboard`; Salesperson filter only (R13); period = close date for won / lost figures, created date for generated; open position is Today.

---

### What this app owns vs. what it doesn't

This app (and its docs) own the IA conventions above, the current build state, and the app-specific build roadmap. It does **not** own the SAP schema, target data architecture, or department-level data-source catalog — that's `hyrax-data-platform/docs/sap-data-architecture-plans/`. Dashboards here get built once that repo has delivered populated, correct tables — don't re-derive SAP table/column semantics in this repo's docs.

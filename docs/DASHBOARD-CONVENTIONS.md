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

---

## 2. When a submodule earns its own Overview + List

A submodule gets the `PageLayout` + tab-bar pattern (Overview _and_ List as siblings) only when **both** are true:

1. It's a distinct, analyzable entity/process with real recurring KPIs or trends a manager would want to check on its own, independent of the module's Reports page.
2. Its List is a genuinely active, maintained operational record set — not a stub, not a pass-through to somewhere else.

Don't migrate a page to the RPC-driven pattern below just to "match the others" — reserve it for pages with real cross-table joins and period-over-period deltas. Small, single-table entities (e.g. headcount-scale lists) are genuinely fine with client-side aggregation.

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
| Finance Reports | **General Ledger (GL)** | `OACT`/`OJDT`/`JDT1` via `base_gl_lines` | True accounting postings |
| Finance Reports | **Invoice** | `sap_invoices` | AR subledger, invoice-line level |
| Finance Reports | **Bill** | `sap_vendor_bills` | AP subledger, bill-line level |
| Finance Reports | **Payment** | `sap_payment_applications`/receipts | Cash actually applied |

**"Client" vs. "Customer" — not interchangeable, but not exclusive to one dashboard either.** "Client" always means the CRM-native `clients` table (Sales Reports' "Top Clients" chart); "Customer" always means SAP's own `customer_code` on `sap_invoices` (Finance Reports' "Top Customers by Revenue," and — added 2026-07 — Sales Reports' own "Customer Concentration" tile/"Top Customers by Invoiced Revenue" chart, converted from CRM to SAP-invoiced per an explicit product decision that concentration risk belongs on audited billing data). Sales Reports now legitimately carries both words side by side, one per source table — don't let either word drift into meaning the same thing as the other, on either dashboard.

Two figures can legitimately disagree (e.g. GL revenue vs. invoice-subledger revenue, or a manually-set budget vs. an audited actual) — that's normal for these table pairings, not a bug to reconcile away. The fix is always to **label both sides so the difference is visible**, never to silently pick one or blend them.

### Watch-outs baked into every reference RPC — respect them in every new query

- SAP dates are stored as `text` — cast `"invoice_date"::date`.
- SAP flags are `'Y'`/`'N'` strings — filter `WHERE is_cancelled = 'N'`; **revenue must never blend cancelled docs**.
- The **RCT2 join trap**: join `sap_payment_applications.payment_ref` → `sap_payments.doc_entry`, never `receipt_number` (see `hyrax-data-platform/docs/data-dictionary.md`). Separately, the FK from a payment-application row to the _invoice_ it settles is `doc_entry` (confirmed — **not** `inv_entry`), filtered `WHERE inv_type = 13` — `doc_entry` is a polymorphic FK whose target depends on `inv_type`, so there's no database-level FK constraint for it; always apply the `inv_type = 13` filter yourself. See that same doc's "RCT2 → invoice link" section.
- SAP's `GrosProfit` has master-data defects — sanitize by nulling GP when `abs(gross_profit) > abs(total_amount_myr) * 5`; reuse that guard anywhere GP is summed.
- **Point-in-time vs. period-bound**: dashboards mix both. "As of today" snapshot metrics (AR aging, overdue customers, open backlog, stock position, active pipeline) deliberately ignore the date-range filter; period-bound metrics (revenue, collections, fill rate, on-time %) respect it. Comment this distinction explicitly at the field level in any new RPC.
- **Previous-period delta pattern**: compute a same-length immediately-preceding window (`v_prev_start_date`/`v_prev_end_date`) server-side, then a client-side `calcDelta(current, previous)` helper turns that into "↑/↓ X% vs last period."
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

**Numeric thresholds are documented estimates, not audited business targets.** Where a dynamic tile needed a real cutoff with no existing target/budget on the page (margin floors, DSO targets, attrition/absenteeism benchmarks, etc.), the threshold is commented inline in that tile's config as a starting point, tunable by Finance/HR/Sales without needing to touch the shared utility.

---

### What this app owns vs. what it doesn't

This app (and its docs) own the IA conventions above, the current build state, and the app-specific build roadmap. It does **not** own the SAP schema, target data architecture, or department-level data-source catalog — that's `hyrax-data-platform/docs/sap-data-architecture-plans/`. Dashboards here get built once that repo has delivered populated, correct tables — don't re-derive SAP table/column semantics in this repo's docs.

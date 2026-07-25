# Dashboard Conventions

Durable rules for how pages/dashboards are structured and built in this app. Rarely changes — if you're adding a new page or RPC, read this first. For what currently exists, see [`DASHBOARD-CURRENT-STATE.md`](./DASHBOARD-CURRENT-STATE.md); for what's planned next, see [`DASHBOARD-ROADMAP.md`](./DASHBOARD-ROADMAP.md).

## 1. Naming convention

- **List** = the table you work out of every day (a lead, an invoice, an asset). Operational, row-level, daily use.
- **Overview** = "how is _this one thing_ (Leads, Clients, Assets, Employees…) doing" — scoped to a single entity/submodule, used by the team running it and their direct manager, checked often.
- **Reports** = "how is _the whole department_ doing" — synthesizes across that module's entities, used by the department head at weekly/monthly cadence. Never just one entity's Overview relabeled.
- **Executive Summary** (doesn't exist yet) = "how is _the whole company_ doing" — synthesizes across departments, for leadership. `CLAUDE.md` names this as the long-term target. Treat it as the natural Tier 4, not something to retrofit into an existing Reports page.

### The 4-tier framework

BI/SaaS products almost universally separate reporting surfaces into four altitudes:

| Tier | Name | Audience / cadence |
| --- | --- | --- |
| 0 | Record detail | Whoever owns that one record; as-needed |
| 1 | **List** | Individual contributor; daily, operational |
| 2 | **Entity/submodule Overview** | The team running that entity + their line manager; daily/weekly |
| 3 | **Module/Departmental "Reports"** | Department manager/director; weekly/monthly |
| 4 | **Executive / cross-module** | C-suite/leadership; monthly/quarterly |

Stephen Few's operational/tactical/strategic taxonomy maps onto this: Tiers 0–1 are operational (real-time, row-level, drill-heavy); Tier 2 is tactical/analytical-but-single-domain (aggregated, filterable, never mixes unrelated entities); Tiers 3–4 are strategic (low-refresh, headline-KPI, cross-entity synthesis, built to be read in five seconds). A submodule's Overview should never try to be a mini-Reports page, and a Reports page should never just be one submodule's Overview relabeled.

## 2. When a submodule earns its own Overview + List

A submodule gets the `PageLayout` + tab-bar pattern (Overview _and_ List as siblings) only when **both** are true:

1. It's a distinct, analyzable entity/process with real recurring KPIs or trends a manager would want to check on its own, independent of the module's Reports page.
2. Its List is a genuinely active, maintained operational record set — not a stub, not a pass-through to somewhere else.

Don't migrate a page to the RPC-driven pattern below just to "match the others" — reserve it for pages with real cross-table joins and period-over-period deltas. Small, single-table entities (e.g. headcount-scale lists) are genuinely fine with client-side aggregation.

## 3. The shared Reports-page build pattern

Every Tier-3 Reports page in this app follows one mold. Don't invent a new shape per department — clone an existing one.

**Backend:** a single Postgres RPC function that takes filter params (date range, rep, customer, status…), computes the previous period for deltas, builds CTEs over the near-raw `sap_*`/app tables, and returns **one** `json_build_object` containing a `kpis` object plus named chart-dataset arrays. Reference implementation to clone: [`supabase/sql_editor/get_finance_dashboard_rpc.sql`](../supabase/sql_editor/get_finance_dashboard_rpc.sql) — `base_invoices`/`base_orders`/`base_payments` CTEs, `kpi_totals`, then the `json_build_object`.

**Frontend:** `useDashboardQuery` → the JSON maps to `OverviewCards` (KPI tiles), `ChartCard` + Recharts renderers (bar/line/pie/horizontal-bar/stacked), `ExportActions` (PDF via `jspdf`), and optional `AISummary`/`GenerateAIButton` (Gemini-backed, writes/reads the shared `ai_dashboard_summaries` table — free to turn on for any dashboard). Page-composition template: `src/pages/user/finance/financialReports/FinancialReports.jsx`.

**Freshness banner:** a metadata service reads `sap_pipeline_state` (`last_run_at`, `last_run_status` per pipeline), takes the **oldest** `last_run_at` as "asOf", and flags `hasFailedPipeline` if any watched pipeline's last run errored. Template: `src/features/finance/reports/private/api/financeMetadataService.js`. Each new dashboard declares its own `*_PIPELINE_NAMES` list — make sure it actually lists every table the RPC depends on (a past miss: Operations' watched-pipeline list excluded `sap_invoices` despite two of its own KPIs depending on it).

**Scale note:** everything computes live over near-raw tables. Total data volume is <100MB (~20k rows). There is **no dbt/materialized-mart layer and none is needed** — don't build one as a prerequisite for any dashboard here.

**Deploy mechanism:** RPCs are plain `.sql` files under `supabase/sql_editor/`, hand-pasted into the Supabase Studio SQL editor — no CLI/migrations wired up. Any RPC edit is a manual deploy step.

### Watch-outs baked into every reference RPC — respect them in every new query

- SAP dates are stored as `text` — cast `"invoice_date"::date`.
- SAP flags are `'Y'`/`'N'` strings — filter `WHERE is_cancelled = 'N'`; **revenue must never blend cancelled docs**.
- The **RCT2 join trap**: join `sap_payment_applications.payment_ref` → `sap_payments.doc_entry`, never `receipt_number` (see `hyrax-data-platform/docs/data-dictionary.md`). Separately, which column is the FK from a payment-application row to the *invoice* it settles is an **open, disputed question** (`inv_entry` vs. `doc_entry`) — see that same doc before trusting any invoice attribution derived from `sap_payment_applications`.
- SAP's `GrosProfit` has master-data defects — sanitize by nulling GP when `abs(gross_profit) > abs(total_amount_myr) * 5`; reuse that guard anywhere GP is summed.
- **Point-in-time vs. period-bound**: dashboards mix both. "As of today" snapshot metrics (AR aging, overdue customers, open backlog, stock position, active pipeline) deliberately ignore the date-range filter; period-bound metrics (revenue, collections, fill rate, on-time %) respect it. Comment this distinction explicitly at the field level in any new RPC.
- **Previous-period delta pattern**: compute a same-length immediately-preceding window (`v_prev_start_date`/`v_prev_end_date`) server-side, then a client-side `calcDelta(current, previous)` helper turns that into "↑/↓ X% vs last period."
- **Proration formula**: day-overlap proration of a monthly target/budget against an arbitrary date range — reuse the existing formula (`sales_targets`/`sales_budgets` proration) rather than re-deriving it, so multiple pages never silently drift apart on the same calculation.

### What this app owns vs. what it doesn't

This app (and its docs) own the IA conventions above, the current build state, and the app-specific build roadmap. It does **not** own the SAP schema, target data architecture, or department-level data-source catalog — that's `hyrax-data-platform/docs/sap-data-architecture-plans/`. Dashboards here get built once that repo has delivered populated, correct tables — don't re-derive SAP table/column semantics in this repo's docs.

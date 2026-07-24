# Department Dashboard Blueprint

_The single build-planning reference for every department's **Reports** page and the data-platform work behind them. For each department this document names the dashboard, its KPIs/charts, and the exact SAP tables that feed each one — tagged by whether it's buildable today, needs surfacing, or is blocked on a new extraction — then sequences the whole build so RPCs and schema are designed **once for the end state**, not repeatedly patched._

> **Companion doc:** [`DASHBOARD-IA-STRATEGY.md`](./DASHBOARD-IA-STRATEGY.md) defines the page-structure and naming conventions (List vs. Overview vs. Reports vs. Executive) and audits the current state of every page. This document does **not** re-litigate page structure — it assumes those conventions and focuses on _what data goes in each Reports page and where that data comes from_. Read the IA doc first for "how pages are shaped"; read this for "what to build and in what order."

---

## 1. Purpose & how to use this document

### The problem this solves

Finance Reports (`FinancialReports.jsx` + `get_finance_dashboard`) was built against the tables that happened to already be extracted, without first asking _what executives and management ultimately need from a finance dashboard_. The result is a page whose shape is pinned to today's data — the moment we want AP aging, true margin, or a department cut, the RPC and the page have to be reworked. This document exists so we don't repeat that for Sales, Operations, Production, or anything else.

### The governing principle: design for the end state, fill in over time

> **Every dashboard RPC is specified as a fixed JSON contract for its full end-state table set from day one.** Each KPI tile and chart-dataset key is wired to its source SAP table. Keys whose source table isn't extracted yet return `0` / `[]` / `null` and render as "—" in the UI. When a table lands, the extractor and one CTE fill that key in — **the RPC signature, the JSON shape, and the React page never change.**

Concretely, when building a new dashboard:

1. Define **all** the KPI tiles and chart arrays the dashboard will _ever_ have — including the ones blocked on data we don't have yet — and name their JSON keys now.
2. Wire the keys whose source table exists; null-fill the rest.
3. Add fields to the payload even when null today (e.g. emit `warehouse_name` alongside `warehouse_code` before the warehouse master is extracted), so a chart's data contract is stable across the whole build-out.
4. Register the dashboard's feeding pipelines in a `*_PIPELINE_NAMES` list (mirroring `financeMetadataService.js`) so the freshness banner works from launch and automatically starts watching new pipelines as they're added.

This turns "we forgot X, now rebuild the RPC" into "X's key was already there returning null; we just filled it in."

### Tagging legend (used throughout §5–§6)

- **(A)** — buildable **today** from the 11 already-extracted SAP tables. Exact table/columns cited.
- **(B)** — data is already synced, just **not surfaced** — needs new UI/query only.
- **(C)** — **blocked**; needs a new SAP extraction (or new app schema). The exact missing table is named.

---

## 2. The shared dashboard pattern (reference once, reuse everywhere)

Every Reports page in this app follows one mold. Do not invent a new shape per department.

**Backend:** a single Postgres RPC function that takes filter params (date range, rep, customer, status…), computes the previous period for deltas, builds CTEs over the near-raw `sap_*` tables, and returns **one** `json_build_object` containing a `kpis` object plus named chart-dataset arrays. Reference implementations to clone:

- [`supabase/sql_editor/get_finance_dashboard_rpc.sql`](../supabase/sql_editor/get_finance_dashboard_rpc.sql) (287 lines) — the cleanest template: `base_invoices`/`base_orders`/`base_payments` CTEs, `kpi_totals`, then a `json_build_object` with `kpis`, `arAgingData`, `revenueTrendData`, `topOverdueCustomersData`, `salesRepRevenueData`, `topCustomersByRevenueData`.
- [`supabase/sql_editor/get_sales_dashboard_rpc.sql`](../supabase/sql_editor/get_sales_dashboard_rpc.sql) (507 lines) — the richer example, incl. the per-rep `scorecardData` block that prorates `sales_targets` against WON revenue for attainment %.

**Frontend:** `useDashboardQuery` → the JSON maps to `OverviewCards` (KPI tiles), `ChartCard` + Recharts renderers (bar/line/pie/horizontal-bar/stacked), `ExportActions` (PDF), and optional `AISummary`/`GenerateAIButton` (writes/reads the shared `ai_dashboard_summaries` table — free to turn on for any dashboard). Page-composition template: `src/pages/user/finance/financialReports/FinancialReports.jsx`.

**Freshness:** a metadata service reads `sap_pipeline_state` (`last_run_at`, `last_run_status` per pipeline) to show a "Last Updated / sync failed" banner. Template: `src/features/finance/reports/private/api/financeMetadataService.js`. Each new dashboard declares its own `*_PIPELINE_NAMES` list.

**Scale note:** everything computes live over near-raw tables. Total data volume is <100MB (~20k rows). There is **no dbt/materialized-mart layer and none is needed** — do not build one as a prerequisite for any dashboard here.

**Watch-outs baked into the reference RPCs (respect them in every new query):**

- SAP dates are stored as `text` — cast `"invoice_date"::date`.
- SAP flags are `'Y'`/`'N'` strings — filter `WHERE is_cancelled = 'N'`; **Finance/revenue must never blend cancelled docs**.
- The **RCT2 join trap**: join `sap_payment_applications.payment_ref` → `sap_payments.doc_entry`, never `receipt_number` (see `DATA-DICTIONARY.md`).
- SAP's `GrosProfit` has master-data defects — `get_finance_dashboard` sanitizes rows where `abs(gross_profit) > abs(total_amount_myr) * 5`; reuse that guard anywhere GP is summed.

---

## 3. SAP data-layer reference matrix

Which SAP tables feed which department dashboards. This is the single source of truth for a schema/RPC change's blast radius. `✅` = extracted today; `⬜` = not extracted (see §7 roadmap).

| SAP table (Supabase name)                  | Extracted | Sales |      Finance      |   Operations    |    Production    |  Procurement  |
| ------------------------------------------ | :-------: | :---: | :---------------: | :-------------: | :--------------: | :-----------: |
| ORDR `sap_sales_orders` + RDR1 `_lines`    |    ✅     |   ●   |         ●         |        ●        |    ● (demand)    |               |
| ODLN `sap_deliveries` + DLN1 `_lines`      |    ✅     |       |                   |        ●        |                  |               |
| OINV `sap_invoices` + INV1 `_lines`        |    ✅     |   ●   |         ●         |        ●        |                  |               |
| ORCT `sap_payments` + RCT2 `_applications` |    ✅     |       |         ●         |                 |                  |               |
| OITM `sap_items`                           |    ✅     |   ●   |                   |        ●        |        ●         | ● (on_order)  |
| OCRD `sap_customers` (C/S/L)               |    ✅     |   ●   |         ●         |        ●        |                  | ● (suppliers) |
| OSLP `sap_sales_persons`                   |    ✅     |   ●   |         ●         |                 |                  |               |
| OPOR/POR1 vendor POs                       |    ⬜     |       |      ● (AP)       | ● (inbound ETA) |                  |       ●       |
| OPDN/PDN1 goods receipt                    |    ⬜     |       |                   |                 | ● (materials in) |       ●       |
| OPCH/PCH1 + OVPM AP invoices/payments      |    ⬜     |       | ● (AP aging, DPO) |                 |                  |       ●       |
| OITW per-warehouse stock                   |    ⬜     |       |                   |        ●        |        ●         |               |
| OWHS warehouse master                      |    ⬜     |       |                   |        ●        |        ●         |               |
| OWOR/WOR1 production orders                |    ⬜     |       |                   |                 |        ●         |               |
| OITT/ITT1 bill of materials                |    ⬜     |       |                   |                 |        ●         |               |
| OINM / OWTR/WTR1 stock movements           |    ⬜     |       |                   |        ●        |        ●         |               |
| OACT + OJDT/JDT1 GL / chart of accounts    |    ⬜     |       |   ● (true P&L)    |                 |  ● (cost var.)   |   ● (spend)   |

App-side (Supabase) tables that matter here: `sales_leads`, `sales_targets`, the dormant `sales_orders` bridge, `clients`, `employees`, `profiles` (see §4).

---

## 4. Salesperson identity & the dual-forecast model

_This section addresses the linkage, the lead→SAP-order bridge, and the two-forecast scorecard design._

### 4.1 The employee ↔ SAP-rep bridge

Two identities for "a salesperson" exist and must be bridged:

- **App side:** `employees.id` (uuid) with `employees.employee_id` (text — the human company employee code).
- **SAP side:** `sap_sales_persons.sales_rep_code` (bigint, SlpCode — the PK that every `sap_*` order/invoice carries as `sales_rep_code`) and `sap_sales_persons.employee_id` (bigint, EmpID — "links to HR employee record if configured").

**The link is a direct join: `employees.employee_id` (the company employee code) = `sap_sales_persons.employee_id` (EmpID).** These two fields hold the same value — the company employee code — so a sales employee in the Supabase `employees` table is matched to their SAP salesperson record on `employee_id`, with **no mapping table and no schema change** required. It is feasible today; it is currently just _unbuilt_ (no query joins across it yet).

> One data note before relying on it: SAP stores `sap_sales_persons.employee_id` (EmpID) as `bigint` while `employees.employee_id` is `text`, so the join casts one side (e.g. `employees.employee_id::bigint = sap_sales_persons.employee_id`, or compare as text). Confirm every sales employee actually has its company code populated in SAP's EmpID field (a one-time data check), since a rep with a blank/mismatched EmpID won't join.

**Join path to the transactional tables (two hops):** SAP orders and invoices carry `sales_rep_code` (SlpCode), **not** the employee code — so the full path is `employees.employee_id` → `sap_sales_persons.employee_id` (EmpID) → `sap_sales_persons.sales_rep_code` → the `sales_rep_code` on `sap_sales_orders`/`sap_invoices`.

**Design rule for SAP-side scorecards:** SAP-based rep metrics are computed keyed by `sales_rep_code` (what the orders/invoices carry), then joined out through `sap_sales_persons.employee_id` = `employees.employee_id` to bring in `employees` + `profiles` **only** for display (name, avatar, department). This mirrors how the CRM scorecard keys by `lead_owner_id` and joins `employees`/`profiles` for display.

### 4.2 Two forecasts, two scorecards, one funnel

A salesperson has two distinct forecasts, measuring two different stages of the same funnel:

```
  Pipeline Target ──▶ PO booked (SAP Sales Order) ──▶ Invoiced (Budget) ──▶ Collected
   [Forecast 1]            leading indicator            [Forecast 2]        (Finance)
   CRM / sales_leads                                    SAP / sap_invoices
```

**Forecast 1 — Pipeline Target (exists today).** `sales_targets` (`lead_owner_id`, `target_month`, `target_revenue`). Prorated across the selected range and compared to WON `actual_revenue` per rep to produce attainment % — this is the `scorecardData` block already live in `get_sales_dashboard_rpc.sql`. It is a **forward-looking / coaching** signal, based on self-reported CRM revenue.

**Forecast 2 — Invoice Budget (new).** Propose a new app table:

```
sales_budgets (
  id, sales_rep_code bigint,   -- keyed to SAP rep (see 4.1); this is what invoices carry
  budget_month date,
  budget_revenue numeric,
  budget_gross_profit numeric  -- optional, enables a GP-attainment view
)
```

This drives a **new SAP-invoice-based rep scorecard** that mirrors the leads scorecard exactly — same `OverviewCards`/`ScorecardList` components, same proration math — but computes actuals from `sap_invoices.total_amount_myr` (system-of-record revenue) per `sales_rep_code`, compared to the prorated `budget_revenue`. It is a **backward-looking / accountable** signal. The **PO / SAP Sales Order** (`sap_sales_orders`) sits between the two as a leading indicator: "booked but not yet invoiced." A rep's full picture becomes: _pipeline attainment (Forecast 1) → order book (PO) → invoice attainment vs budget (Forecast 2) → collected (Finance)_.

> The existing dormant `sales_attainment_snapshots` table is the natural place to lock period-end attainment for **both** scorecards once they're stable, for audit/comp purposes.

### 4.3 The lead → SAP Sales Order link

A lead's `po_number` (already a `UNIQUE` column on `sales_leads`) maps to **`sap_sales_orders.customer_ref`** (SAP NumAtCard — the customer's own PO reference on the order). This is the bridge that converts a rep's **manually-typed** WON `actual_revenue` into **validated** SAP order/invoice actuals: once a WON lead's PO number matches a SAP sales order, the deal's realized value comes from SAP, not from what the rep typed. The dormant `sales_orders` bridge table (`sap_so_id`, `sales_lead_id`, `sales_quotation_id`) already exists in the schema for exactly this linkage and is currently unused.

### 4.4 Sales Leads architecture — two paths (decision deferred)

The user is weighing whether to keep the current Supabase-native leads model or re-platform it onto SAP master data. Both are documented here; **the choice is deliberately deferred to the phase where leads work is picked up.**

**Path A — Evolve + bridge (lower risk, incremental).** Keep Supabase `sales_leads` as the pipeline system-of-record. Add the two bridges from §4.1 and §4.3 (employee↔rep, lead PO→SAP order). CRM stays authoritative for _pipeline_; SAP becomes authoritative for _realized revenue_. Nothing existing is rebuilt; the dead `sales_orders`/`sales_budgets` bridges get wired.

- _Pros:_ minimal disruption; the mature Leads Overview keeps working; ships fast.
- _Cons:_ two client identities persist (`clients.sap_bp_id` ↔ `sap_customers.customer_code`) and must be reconciled; the manually-uploaded `clients` table stays a maintenance point.

**Path B — Re-platform on SAP (cleaner long-term, larger rebuild).** Rebuild leads to key off `sap_customers` (business partners) and `sap_sales_persons` directly, deprecating the manual `clients` upload and employee-based attribution.

- _Pros:_ one source of truth for customers and reps; no reconciliation; a lead flows natively into its SAP order/invoice.
- _Cons:_ significant rebuild of the leads module (attribution, filters, the whole `clients` CRUD); SAP business-partner data must be clean enough to drive a CRM; leads for _prospects not yet in SAP_ need a "lead-only" business-partner concept (SAP's `card_type='L'` exists for this).

**Trade-off to resolve at decision time:** who owns a salesperson and a customer identity — the app or SAP? Path A defers that; Path B answers "SAP." A reasonable sequence is _start on Path A_ (get the bridges and the invoice-budget scorecard working now) and _revisit Path B_ only if the dual-identity reconciliation becomes a real pain. But this is explicitly the user's call.

---

## 5. Per-department Reports blueprints

### 5.1 Sales Reports _(Tier 3 — needs building; replaces the current Looker iframe)_

- **Audience / cadence:** Sales Manager + exec stakeholders; monthly/quarterly (distinct from Leads Overview's daily rep-coaching cadence).
- **Core question:** _"Is the sales department hitting both its pipeline and its invoiced-revenue forecasts, and where is the growth (or risk) concentrated?"_

| KPI / chart                                      | Tag | Source & sketch                                                                                                                                                  |
| ------------------------------------------------ | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline attainment (Forecast 1)                 | A   | Aggregate of `scorecardData` — `sales_targets` prorated vs WON `actual_revenue`                                                                                  |
| Invoice-budget attainment (Forecast 2)           | A\* | `sap_invoices.total_amount_myr` per `sales_rep_code` vs prorated `sales_budgets.budget_revenue`. _Data exists today; needs the new `sales_budgets` table (§4.2)_ |
| Order book / PO booked (leading indicator)       | A   | `sap_sales_orders.total_amount_myr` where `is_cancelled='N'`, by rep/period                                                                                      |
| Realized (SAP) vs pipeline-implied (CRM) revenue | A/B | Two series side by side — **label as two systems of record, never blend into one number**                                                                        |
| Win rate, avg deal size, avg days-to-close       | A   | Already in `get_sales_leads_dashboard.kpis`                                                                                                                      |
| Quote-to-win conversion & median days-to-win     | A   | From `sales_leads` fields + `sales_leads_stage_history` — **not** the dormant `sales_quotations` tables                                                          |
| Product-type mix of won revenue                  | A   | `get_sales_leads_dashboard.productTypeData`                                                                                                                      |
| Lead-source ROI                                  | A   | `sourceData`                                                                                                                                                     |
| Top clients / account concentration              | A   | `topClientsData`, plus realized revenue via `clients.sap_bp_id`→`sap_customers` (⚠ manual, unvalidated — audit match rate)                                       |
| Gross profit by rep                              | A   | `sap_invoices.gross_profit` (apply the GP sanitization guard)                                                                                                    |

- **Design-around end-state set:** `sales_leads`(+targets, +new `sales_budgets`), `sap_sales_orders`, `sap_invoices`, `sap_sales_persons`. All extracted today except the `sales_budgets` app table — so Sales Reports is effectively fully buildable now.
- **Executive rollup:** pipeline attainment % + invoice-budget attainment % (the two forecasts), and total order book value.

### 5.2 Finance Reports _(Tier 3 — already built; design in the missing big-picture pieces now)_

- **Audience / cadence:** Finance Manager + execs; monthly close.
- **Already live (`get_finance_dashboard`):** Revenue Invoiced, Cash Collected, Outstanding AR, Overdue Risk, DSO, collection rate (all with prev-period deltas); AR Aging buckets; Revenue Trend (invoiced vs collected); Top Overdue Customers; Salesperson Health (revenue/GP by rep); Top Customers by Revenue.

| Addition to design into the contract now | Tag                                                                                             | Source & sketch                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Unallocated-payments drill-down list     | B                                                                                               | `sap_payments.unallocated_amount` (`NoDocSum`) — the KPI tile exists, no supporting list of who's sitting on unapplied cash         |
| Net-of-returns caveat / net revenue      | C                                                                                               | Blocked on Returns/Credit Memos (ORIN/RIN1). Until extracted, **label current revenue "gross of returns"** — it silently overstates |
| AP Aging (mirror of AR Aging)            | C                                                                                               | Blocked on OPCH/PCH1 + OVPM (Procurement chain). Same bucket renderer as AR aging                                                   |
| DPO (days payable) beside DSO            | C                                                                                               | Blocked on OPCH/OVPM                                                                                                                |
| True gross margin % trend                | B for a rollup of existing sanitized GP; **C** for true COGS-based margin (needs GL: OACT/JDT1) |
| Company-wide P&L / EBITDA                | C                                                                                               | Blocked on GL. **State plainly: Finance today is AR-only — an AR subledger with a Finance label, not full financials**              |

- **Design-around end-state set:** OINV, ORCT, ORDR (have) + ORIN, OPCH/OVPM, OACT/JDT1 (need). The point: the RPC should already have `apAgingData`, `netRevenue`, `grossMargin` keys returning null so adding AP/GL later is a data fill, not a rebuild.
- **Executive rollup:** revenue invoiced, cash collected, outstanding AR, DSO, collection rate.

### 5.3 Operations & Fulfilment Reports _(Tier 3 — new; the strongest launch candidate, nearly all (A))_

- **Audience / cadence:** Operations / Supply-Chain Manager; daily standup + weekly.
- **Core question:** _"Are we shipping what customers ordered — in full, on time — and what's stuck in the pipeline right now?"_

| KPI / chart                                         | Tag                 | Source & sketch                                                                                                                                                            |
| --------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open order backlog (value + count)                  | A                   | `sap_sales_orders` where `status_code='O'`, `is_cancelled='N'`; sum `total_amount_myr`. Line-level open value = `sap_sales_order_lines.open_qty × unit_price`              |
| Undelivered units by item/group                     | A                   | `sap_sales_order_lines.open_qty` grouped by `item_code`/`item_group_code`                                                                                                  |
| On-time delivery % (vs customer request) — headline | A                   | Join `sap_delivery_lines.base_entry→sap_sales_orders` (`base_type=17`); on-time = `sap_deliveries.delivery_date ≤ sap_sales_orders.delivery_date` (requested `DocDueDate`) |
| On-time delivery % (vs internal promise)            | A                   | `sap_deliveries.delivery_date ≤ sap_deliveries.promised_delivery_date`                                                                                                     |
| Fill rate / order completeness                      | A                   | `Σ delivered_qty ÷ Σ quantity` on `sap_sales_order_lines`; "shipped complete" = all lines `open_qty=0`                                                                     |
| Fulfilment cycle time (order→ship→invoice)          | A                   | Chain dates via base-links: `ODLN.delivery_date − ORDR.order_date`, then `OINV.invoice_date − ODLN.delivery_date` (`base_type=15`)                                         |
| Backlog aging / at-risk open orders                 | A                   | Open orders bucketed by `current_date − order_date`; risk list where requested `delivery_date < current_date` and `open_qty>0` (reuse the AR-aging renderer)               |
| Shipment volume trend                               | A                   | `sap_deliveries` count + `sap_delivery_lines.quantity` by week/month                                                                                                       |
| Aggregate stock cover / ATP proxy                   | A                   | `sap_items`: available ≈ `stock_on_hand − committed_stock`; days-of-cover vs trailing shipped qty; over-commit flag where `committed_stock > stock_on_hand`                |
| Local vs export & packaging split                   | B                   | `sap_customers.local_export_flag` + `sap_items.packaging` — synced, never surfaced                                                                                         |
| Fulfilment by warehouse                             | A (code) / C (name) | `warehouse_code` groupable now; needs **OWHS** for names                                                                                                                   |
| Per-warehouse stock levels                          | C                   | **OITW** — today only company-wide `OnHand` exists; "which warehouse is short" is impossible                                                                               |
| Inventory turnover / movements / transfer lead time | C                   | **OINM**, **OWTR/WTR1**                                                                                                                                                    |
| Dated inbound replenishment ETA                     | C                   | `sap_items.on_order` gives a company-wide qty only; needs **OPOR/POR1** for dates/supplier                                                                                 |

- **Design-around end-state set:** ORDR/RDR1, ODLN/DLN1, OINV/INV1, OITM, OCRD (have) + OITW, OWHS, OINM/OWTR, OPOR (need). Emit `warehouse_name` (null until OWHS) and a `stockPosition` sub-object that starts company-wide and gains a per-warehouse array (empty until OITW) — same keys, richer payload later.
- **Executive rollup:** open order backlog value (RM) + on-time-delivery %.

### 5.4 Production & Plant Reports _(Tier 3 — new; mostly blocked today — honest framing)_

- **Audience / cadence:** Production / Plant Manager; daily shift + weekly.
- **Core question:** _"Are we producing enough of the right products, at expected yield and cost, to cover committed demand?"_

**Honest assessment: almost nothing about actual production is buildable today.** Launch content is demand-/inventory-side _proxies_ a planner values, clearly labeled as such — not true output.

| KPI / chart                                                                   | Tag                | Source & sketch                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demand-pull signal (what to make)                                             | A                  | `sap_sales_order_lines.open_qty` on open orders, by item/group — committed demand not yet delivered (reuses Operations backlog)                                      |
| Finished-goods replenishment candidates                                       | A                  | `sap_items` where `stock_on_hand − committed_stock < threshold` (⚠ `on_order` = open _purchase_ orders, an imperfect "incoming" signal for a manufacturer — flag it) |
| Throughput proxy                                                              | A (labelled proxy) | `sap_delivery_lines.quantity` shipped by item over time — a demand stand-in, **not** production output                                                               |
| Product mix                                                                   | A                  | `item_group_code` / `packaging` distribution of shipped volume                                                                                                       |
| Production output / volume, WIP, open vs completed orders, schedule adherence | C                  | **OWOR/WOR1** — planned vs actual produced qty, status, scheduled vs completed dates                                                                                 |
| Yield % / scrap / consumption variance                                        | C                  | **OWOR** planned vs actual issued via **OINM**, against **OITT/ITT1** BOM standard                                                                                   |
| Standard-vs-actual material cost variance                                     | C                  | **OWOR** actuals vs **OITT** standard; GL-level variance needs **OACT + OJDT/JDT1**                                                                                  |
| Machine uptime / OEE / downtime / tank levels                                 | C — IoT, not SAP   | Source is the planned **Plant IoT sensor** pipeline, not any SAP table                                                                                               |

- **⚠ Genuine business-priority call (the big one):** _Is a SAP-driven Production dashboard worth pursuing at all, or should production metrics wait for the IoT pipeline?_ The two sources are **complementary, not competing** — SAP OWOR/OITT/OINM answers transactional/planning questions (order counts, planned-vs-actual qty, yield, cost variance); IoT answers real-time physical questions (OEE, downtime, flow/tank telemetry). **Recommendation:** don't wait for IoT to stand up a dashboard, but **don't commit engineering to OWOR extraction until a 1–2 day scoping spike confirms Hyrax actually books production orders in SAP with well-populated planned/actual quantities and BOMs.** Many blending SMEs run production off-system or with skeletal OWOR records. If well-populated → high value, build it; if sparse → defer output/yield to IoT and ship only the demand/inventory proxy panel. This is a data-reality question about Hyrax's specific SAP instance, answerable only by querying the live tables.
- **Design-around end-state set:** `sap_items` + RDR1 demand proxy (have) + OWOR/WOR1, OITT/ITT1, OINM (SAP production core), IoT telemetry tables (separate pipeline). Define named sub-objects now — `demandSignal` (live), `output`/`yield`/`schedule` (empty until OWOR+OITT+OINM), `plantTelemetry` (empty until IoT).
- **Executive rollup:** target = output volume + yield % (blocked until OWOR); interim proxy = committed-demand backlog (units).

### 5.5 Procurement & Payables Reports _(Tier 3 — new; mostly blocked — design the contract, build when data lands)_

- **Audience / cadence:** Procurement Manager + AP/Finance (shared); weekly procurement review, AP-due list daily/weekly.
- **Core question:** _"What have we committed to buy, is it arriving on time, and what do we owe suppliers and when?"_

| KPI / chart                                                      | Tag                | Source & sketch                                                                                                                |
| ---------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Active supplier directory / counts by country·industry           | A (thin)           | `sap_customers` where `card_type='S'`                                                                                          |
| Supplier outstanding balance                                     | B (low-confidence) | `sap_customers.balance` for supplier rows _may_ reflect AP balance; can't be aged/verified without OPCH/OVPM — indicative only |
| Open-PO commitment (coarse)                                      | A/B (very coarse)  | `sap_items.on_order × last_purchase_price` — item-level company-wide only; no PO/supplier/date                                 |
| Open purchase orders — commitment value, count, open vs received | C                  | **OPOR/POR1** — the core table                                                                                                 |
| Supplier OTIF (inbound on-time-in-full), lead time               | C                  | **OPOR** promised date vs **OPDN/PDN1** goods-receipt actual                                                                   |
| Goods received not invoiced (GRNI)                               | C                  | **OPDN** vs **OPCH** reconciliation                                                                                            |
| AP aging / payables due / DPO                                    | C                  | **OPCH/PCH1** + **OVPM** — AP aging mirrors AR aging; DPO mirrors DSO                                                          |
| Spend by supplier / category / item                              | C                  | **OPCH** lines + **POR1**                                                                                                      |
| Three-way match (PO ↔ GRPO ↔ AP invoice)                         | C                  | **OPOR + OPDN + OPCH** via base-links — the exact mirror of the sales chain                                                    |

- **⚠ Business-priority call:** **do not ship a supplier-master-only stub page** — a page showing only a supplier directory + coarse on-order number repeats the Finance mistake in miniature (UI pinned to thin data). Instead **define the full RPC contract now and build the React page when OPOR lands** (which is the #1 extraction below anyway).
- **Design-around end-state set:** the exact mirror of the already-extracted sales chain — OPOR→OPDN→OPCH→OVPM (+ OACT/JDT1 for GL spend). Template `get_procurement_dashboard` directly on `get_finance_dashboard`: AP aging = AR aging buckets, DPO = DSO, supplier OTIF = customer OTD, open-PO backlog = order backlog.
- **Executive rollup:** open-PO commitment (RM) + AP due (RM) — sits beside Finance's AR to complete the cash-in-vs-cash-out picture.

### 5.6 IT & HR — explicitly parked (for now)

- **IT:** the Assets **Overview** already exists and is sufficient for what is currently a single-user (you) function. **Defer a Tier-3 "IT Reports" page** — there's only one real entity (Assets) to synthesize, and Software Management has no data model yet. Revisit if/when IT becomes multi-user and Software has a real schema. (The "IT Dashboard" rename and the `purchase_cost`/`warranty_expiry` text-column data-quality bugs are tracked in the IA strategy doc's punch-list.)
- **HR:** the data-handling strategy is **undecided pending the HR2000-integration decision** (the HR module was built app-native before that integration was considered). **Hold HR dashboarding** until that direction is settled — building HR Reports now risks rework once HR2000 reshapes the data model. The rich-but-unexposed attendance data, the two mislabeled Employee-Overview KPI cards, and the broken `hr/reports` nav link are all captured in the IA strategy doc's punch-list, not here.

---

## 6. Executive Summary dashboard _(Tier 4 — how each department flows up)_

The first real instance of `CLAUDE.md`'s stated goal ("real-time dashboards for every department and for executives"). Built the same way — one `get_executive_dashboard` RPC + the shared components. Each department contributes 1–3 headline numbers:

| Department  | Rollup metric(s)                                                       | Tag                                      |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| Sales       | Pipeline attainment % + invoice-budget attainment % + order book value | A / A\* / A                              |
| Finance     | Revenue invoiced, cash collected, outstanding AR, DSO, collection rate | A                                        |
| Operations  | Open order backlog value + on-time-delivery %                          | A                                        |
| Production  | Output volume + yield %                                                | C (interim: committed-demand backlog, A) |
| Procurement | Open-PO commitment + AP due                                            | C                                        |

_A\* = data exists today, needs the new `sales_budgets` table._

**The ceiling to state up front:** a true **department-level P&L or cost allocation is blocked twice over** — there is no GL data (no OACT/JDT1) _and_ no department dimension on any `sap_*` table (SAP data carries only `customer_code`/`sales_rep_code`/`item_code`, never a department or cost-center). So the Executive dashboard can show company revenue, cash, backlog, and (once unblocked) payables and production — but **not** "profit by department" until both the GL is extracted and a cost-center/department mapping is introduced. (The HR/IT/Sales app-side data _can_ be sliced by department via `employees.department_id`; the SAP-sourced financials cannot — see the linkage audit in the IA strategy doc.)

---

## 7. Data-platform roadmap — extraction sequence

Derived from the dashboards above and ranked by how many dashboards/KPIs each unlocks. Each new SAP table is a bounded extractor lift at this data volume (copy the existing per-table extractor pattern; ~seconds per incremental run).

1. **Vendor-PO / AP chain — `OPOR/POR1` → `OPDN/PDN1` → `OPCH/PCH1 + OVPM`.** Highest unlock, lowest risk. It's a structural mirror of the already-built sales chain (extractors copy `deliveries.py`/`invoices.py`; the RPC templates off `get_finance_dashboard`). Unlocks four things at once: Procurement goes stub→live; Finance gains AP aging + DPO (completing the cash picture beside AR); Operations gains dated inbound ETA; Exec gains payables. Sequence so each sub-step ships value: OPOR (commitment/backlog) → OPDN (OTIF, lead time, GRNI) → OPCH+OVPM (AP aging, DPO, spend).
2. **`OITW` + `OWHS` — per-warehouse stock + warehouse dimension.** Small, cheap, dimension-like. Immediately enriches the strong Operations dashboard — real multi-warehouse visibility + named warehouses. Do in parallel with / right after #1.
3. **`OWOR/WOR1` (+ `OITT/ITT1`, `OINM`) — production core.** Most on-brand for a manufacturer and the only path to real output/yield/cost-variance, but the largest extraction surface and contingent on Hyrax actually maintaining production orders + BOMs in SAP. **Gate behind the 1–2 day scoping spike** (§5.4) before committing.
4. **`OACT` + `OJDT/JDT1` — GL / Chart of Accounts.** Unblocks true P&L / COGS / gross margin for Finance and Exec, and GL-level cost variance for Production. A larger, accounting-driven effort (and needs a cost-center decision to enable department cuts) — sequence after the cheaper high-unlock items unless a true P&L is an urgent executive need.

**Two non-extraction tasks that gate Sales:** the `employees.employee_id` = `sap_sales_persons.employee_id` (EmpID) join (§4.1) — a one-time data check that every sales employee's company code is populated in SAP's EmpID, no schema change — and the new `sales_budgets` table (§4.2). Both are prerequisites for the invoice-budget scorecard.

---

## 8. Phasing summary

| Phase                                          | Dashboards shipped                                                                                                                    | SAP tables / schema landed                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Use what we have**                       | Sales Reports (both forecasts), Operations & Fulfilment, Finance contract-expansion (unallocated drill-down + null-keyed AP/GL slots) | No new SAP extraction. App-side: `sales_budgets` table, wire the employee↔rep join (`employee_id`=EmpID, data check only), wire the dormant `sales_orders` bridge (lead PO→SAP order) |
| **2 — Complete the cash & fulfilment picture** | Procurement & Payables (stub→live), Operations enriched (per-warehouse, named)                                                        | OPOR/POR1 → OPDN/PDN1 → OPCH/PCH1 + OVPM; OITW + OWHS                                                                                                                                 |
| **3 — Manufacturer depth**                     | Production & Plant (pending spike outcome), Finance true-financials                                                                   | OWOR/WOR1 + OITT/ITT1 + OINM (spike-gated); OACT + OJDT/JDT1 (GL)                                                                                                                     |
| **4 — Company-wide**                           | Executive Summary rollup                                                                                                              | None new — aggregates the department RPCs once they're solid                                                                                                                          |

Phase 1 is entirely buildable with today's 11 tables plus three small app-side changes. Everything after is additive against the fixed RPC contracts from §1.

---

## 9. Open decisions (the user's calls — not derivable from best practice)

1. **Sales Leads architecture — Path A (evolve+bridge) vs Path B (re-platform on SAP)** (§4.4). Recommended to start on A and revisit B; deferred by decision.
2. **Canonical revenue definition for the invoice-budget scorecard** — order-booked vs invoiced vs collected. Recommended: invoiced (`sap_invoices`), since it's the system-of-record billed figure; but comp policy may prefer collected.
3. **Production: pursue SAP OWOR vs wait for the IoT pipeline** (§5.4) — answer via the scoping spike on Hyrax's live SAP data.
4. **Fund GL (Phase 3/4) earlier?** — if a true P&L is an urgent executive need, GL jumps ahead of the manufacturer-depth work; otherwise it sequences after the cheaper high-unlock extractions.
5. **HR dashboarding timing** — held until the HR2000-integration direction is decided (§5.6).

# Dashboard Roadmap

What to build next in this app, in what order, and why — plus the open decisions and punch-list items that block or shape that work. Living document — update as priorities shift. For naming/build conventions, see [`DASHBOARD-CONVENTIONS.md`](./DASHBOARD-CONVENTIONS.md); for what currently exists, see [`DASHBOARD-CURRENT-STATE.md`](./DASHBOARD-CURRENT-STATE.md).

**Ownership note:** this app does not own SAP schema or target data-architecture decisions — `hyrax-data-platform/docs/sap-data-architecture-plans/` is the source of truth for what data exists/will exist and how it's modeled. This doc assumes that repo delivers populated, correct tables, and focuses purely on what UI/dashboard work to do once they're available. It does name the app's own Supabase tables (`sales_leads`, `sales_targets`, `employees`, etc.) where the design is genuinely app-specific.

## 1. Salesperson identity & the dual-forecast model

### 1.1 The employee ↔ SAP-rep bridge

Two identities for "a salesperson" exist and must be bridged:

- **App side:** `employees.id` (uuid) with `employees.employee_id` (text — the human company employee code).
- **SAP side:** `sap_sales_persons.sales_rep_code` (bigint, SlpCode — the PK every `sap_*` order/invoice carries as `sales_rep_code`) and `sap_sales_persons.employee_id` (bigint, EmpID — links to HR employee record if configured).

**The link is a direct join: `employees.employee_id` (company employee code) = `sap_sales_persons.employee_id` (EmpID).** No mapping table, no schema change — just unbuilt. Cast one side (`employees.employee_id::bigint = sap_sales_persons.employee_id`, or compare as text), and confirm every sales employee's company code is actually populated in SAP's EmpID field first (a one-time data check).

**Join path to transactional tables (two hops):** SAP orders/invoices carry `sales_rep_code` (SlpCode), not the employee code — so the full path is `employees.employee_id` → `sap_sales_persons.employee_id` (EmpID) → `sap_sales_persons.sales_rep_code` → the `sales_rep_code` on `sap_sales_orders`/`sap_invoices`.

**Design rule:** SAP-based rep metrics are computed keyed by `sales_rep_code` (what orders/invoices carry), then joined out through `sap_sales_persons.employee_id = employees.employee_id` to bring in `employees`/`profiles` **only** for display (name, avatar, department) — never for the attribution math.

### 1.2 Two forecasts, two scorecards, one funnel

```
  Pipeline Target ──▶ PO booked (SAP Sales Order) ──▶ Invoiced (Budget) ──▶ Collected
   [Forecast 1]            leading indicator            [Forecast 2]        (Finance)
   CRM / sales_leads                                    SAP / sap_invoices
```

**Forecast 1 — Pipeline Target (exists today).** `sales_targets` (`lead_owner_id`, `target_month`, `target_revenue`), prorated and compared to WON `actual_revenue` per rep. Forward-looking/self-reported coaching signal — already live as Leads Overview's `scorecardData`.

**Forecast 2 — Invoice Budget (new).** `sales_budgets` (`sales_rep_code`, `budget_month`, `budget_revenue`, optional `budget_gross_profit`) drives a new SAP-invoice-based rep scorecard mirroring the leads scorecard exactly, computing actuals from `sap_invoices.total_amount_myr` per `sales_rep_code` vs. prorated budget. Backward-looking/accountable signal.

The dormant `sales_attainment_snapshots` table is the natural place to lock period-end attainment for both scorecards once stable, for audit/comp purposes.

### 1.3 The lead → SAP Sales Order link

`sales_leads.po_number` (unique) maps to `sap_sales_orders.customer_ref` (SAP NumAtCard). This bridge converts a rep's manually-typed WON `actual_revenue` into SAP-validated actuals. The dormant `sales_orders` bridge table (`sap_so_id`, `sales_lead_id`, `sales_quotation_id`) exists for exactly this, currently unused.

### 1.4 Sales Leads architecture — two paths (decision deferred)

**Path A — Evolve + bridge (lower risk, incremental, recommended to start here).** Keep Supabase `sales_leads` as pipeline system-of-record; add the bridges above. CRM stays authoritative for pipeline, SAP for realized revenue.

**Path B — Re-platform on SAP (cleaner long-term, larger rebuild).** Key leads off `sap_customers`/`sap_sales_persons` directly, deprecating the manual `clients` upload.

Start on Path A; revisit Path B only if dual-identity reconciliation (`clients.sap_bp_id` ↔ `sap_customers.customer_code`) becomes a real pain. User's call.

## 2. Per-department Reports pages — what to build

### 2.1 Sales Reports _(Tier 3 — replaces the current Looker iframe)_

Audience: Sales Manager + execs, monthly/quarterly. Core question: is the department hitting both its pipeline and invoiced-revenue forecasts, and where is growth/risk concentrated? Content: pipeline attainment (Forecast 1), invoice-budget attainment (Forecast 2, needs `sales_budgets` — see §1.2), order book, realized-vs-pipeline revenue (labeled as two systems of record, never blended), win rate/deal size/cycle time, product-type mix, lead-source ROI, top clients, gross profit by rep. Fully buildable today except the new `sales_budgets` table.

### 2.2 Finance Reports _(Tier 3 — already built; design in the missing pieces)_

Already live: Revenue Invoiced, Cash Collected, Outstanding AR/DSO, Overdue Risk, AR Aging, Revenue Trend, Top Overdue Customers, Salesperson Health, Top Customers. To design in now (contract-first, even if null-filled until data lands): unallocated-payments drill-down list; a net-of-returns caveat/net revenue figure (blocked on Returns/Credit-Memo extraction); AP Aging + DPO (blocked on vendor-PO/AP chain); true gross margin/P&L (blocked on GL). State plainly in the UI: Finance today is AR-only.

### 2.3 Operations & Fulfilment Reports _(Tier 3 — new; strongest launch candidate)_

Audience: Operations/Supply-Chain Manager, daily standup + weekly. Content: open order backlog, undelivered units, on-time delivery (vs. request and vs. internal promise), fill rate, fulfilment cycle time, backlog aging, shipment volume trend, aggregate stock cover. Per-warehouse detail and inbound-ETA are blocked pending data-platform delivering warehouse/PO tables.

### 2.4 Production & Plant Reports _(Tier 3 — new; mostly blocked today)_

Audience: Production/Plant Manager, daily shift + weekly. Honest framing: almost nothing about actual production is buildable today — launch content is demand-/inventory-side proxies (committed demand from open order lines, replenishment candidates, shipped-volume-as-throughput-proxy), clearly labeled as proxies, not true output. Real output/yield/cost-variance is gated behind data-platform's production-core extraction, itself gated behind a scoping spike confirming Hyrax actually books well-populated production orders + BOMs in SAP. Don't wait for that spike to ship the demand/inventory proxy panel, but don't build the output/yield panel before it either.

### 2.5 Procurement & Payables Reports _(Tier 3 — new; mostly blocked)_

Audience: Procurement Manager + AP/Finance, weekly review + daily/weekly AP-due list. Core question: what have we committed to buy, is it arriving on time, what do we owe and when? Almost everything here is blocked on data-platform's vendor-PO/AP chain. **Don't ship a supplier-master-only stub page** — define the full RPC contract now (mirroring Finance's AR shape: AP aging = AR aging, DPO = DSO, supplier OTIF = customer OTD) and build the React page once that data lands.

### 2.6 IT & HR — explicitly parked

**IT:** Assets Overview already exists and is sufficient for a single-user function. Defer a Tier-3 "IT Reports" page until Software Management has a real data model to synthesize against.

**HR:** Hold HR Reports until the HR2000-integration direction is settled (the HR module was built app-native before that integration was considered) — building now risks rework once HR2000 reshapes the data model.

## 3. Executive Summary dashboard _(Tier 4 — how each department flows up)_

Built the same way as every other Reports page: one `get_executive_dashboard` RPC + the shared components. Each department contributes 1–3 headline numbers:

| Department | Rollup metric(s) |
| --- | --- |
| Sales | Pipeline attainment % + invoice-budget attainment % + order book value |
| Finance | Revenue invoiced, cash collected, outstanding AR, DSO, collection rate |
| Operations | Open order backlog value + on-time-delivery % |
| Production | Output volume + yield % (interim: committed-demand backlog) |
| Procurement | Open-PO commitment + AP due |

**The ceiling to state up front:** a true department-level P&L or cost allocation is blocked twice over — no GL data, and no department/cost-center dimension on any `sap_*` table. HR/IT/Sales app-side data _can_ be sliced by department (`employees.department_id`); SAP-sourced financials cannot, until both the GL lands and a cost-center mapping exists.

## 4. Prioritized punch-list

### Group A — IA/navigation fixes _(cheap, days not weeks)_

- Fix the FIN/SAL access-control mismatch on Finance Invoices.
- Fix HR Employees Overview's two mislabeled KPI cards.
- Fix or remove the broken `hr/reports` nav link.
- Rename "IT Dashboard" away from the word "Dashboard."
- Resolve the Quotations orphan-route contradiction.
- Add a dual-labeling disclosure on Leads Overview + Finance Salesperson Health (§5 below).

### Group B — New feature builds _(real scope, needs its own sequencing)_

- Build Attendance Overview (flagship — do this first; see `DASHBOARD-CURRENT-STATE.md` §2 HR).
- Build Clients Overview.
- Build native Sales Reports, retiring the Looker iframe.
- Build HR Reports (after the HR2000 direction settles).
- Fold Quotations into Leads as a List-only tab, or formally retire it.
- Re-enable Finance's commented-out AI Summary.
- Fix `it_assets.purchase_cost`/`warranty_expiry` column types (currently `text`, not `numeric`/`date`), then add the cost/warranty KPIs — migrate + backfill first, don't inline-cast as a shortcut.
- Activate Leave — after Attendance Overview + HR Reports v1, and after confirming timing against the HR2000 roadmap.
- Build Executive Summary — once departmental Reports pages are solid.

### Group C — Data-correctness fixes _(needs `hyrax-data-platform` alignment first)_

- **`get_finance_dashboard_rpc.sql`'s payment-application join** (`pa.inv_entry = i.doc_entry`) implements an old, disputed RCT2→invoice assumption. `hyrax-data-platform/docs/sap-data-architecture-plans/01-sap-schema-relationships.md` (treated as source of truth for the target model) says the FK should be `doc_entry`, not `inv_entry` — but this is **not yet confirmed against live SAP data** (see `hyrax-data-platform/docs/data-dictionary.md`'s "RCT2 → invoice link"). Once verified, fix this RPC's join and re-check anything downstream that reads `sap_payment_applications.inv_entry` as an invoice key.
- The `employees` ↔ `sap_sales_persons` reconciliation mapping (§1.1) — a one-time data check, not new extraction.
- Wire the dead `sales_orders` bridge table (§1.3).
- Reconcile the DSO methodology mismatch between this app's live point-in-time formula and the target KPI framework's average-AR formula — see `DASHBOARD-CURRENT-STATE.md` §6.

## 5. Salesperson performance — the disclosed duality

Two structurally disconnected definitions of "salesperson performance" exist today: the CRM scorecard (`sales_leads.actual_revenue`, manually typed, forward-looking, keyed by `lead_owner_id`) and Finance's "Salesperson Health" (`sap_sales_orders.total_amount_myr` + GP, SAP system-of-record, backward-looking, keyed by `sales_rep_code`). This is normal for CRM+ERP run side by side — CRM is a forecasting/coaching signal, ERP-recognized revenue is the only one that should be compensation-bearing.

**Now (zero data-model work):** don't silently pick a winner. Relabel Leads Overview's scorecard as "Pipeline Attainment — CRM, self-reported, vs. quota"; relabel Finance's as "Recognized Revenue & GP by Rep — SAP system-of-record, no quota yet"; add a shared disclosure that they use different identity keys and revenue definitions and may legitimately disagree.

**Later:** build the identity bridge (§1.1), wire the dead `sales_orders` bridge (§1.3), decide the canonical revenue definition for compensation (open decision below), then surface one attainment number at both cadences.

## 6. Open decisions — the user's calls, not derivable from best practice

1. Sales Leads architecture — Path A vs Path B (§1.4). Recommended: start on A, revisit B only if pain emerges.
2. Canonical revenue definition for the invoice-budget scorecard and for compensation — order-booked vs. invoiced vs. collected; CRM self-reported vs. SAP-recognized. Finance/business-policy call.
3. Production: pursue SAP OWOR extraction vs. wait for the Plant IoT pipeline (§2.4) — answer via the scoping spike on Hyrax's live SAP data.
4. HR dashboarding timing — held until the HR2000-integration direction is decided (§2.6).
5. Whether Recruitment/Performance/Claims/Software Management data models are worth building at all right now, vs. deferring indefinitely.
6. Whether existing license-visibility tools (ManageEngine, vendor portals) already cover what a bespoke Software Management schema would provide.
7. Whether Contacts warrants a standalone cross-client directory vs. staying embedded-per-client only.

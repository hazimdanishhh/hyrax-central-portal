# Dashboard Roadmap

What to build next in this app, in what order, and why — plus the open decisions and punch-list items that block or shape that work. Living document — update as priorities shift. For naming/build conventions, see [`DASHBOARD-CONVENTIONS.md`](./DASHBOARD-CONVENTIONS.md); for what currently exists, see [`DASHBOARD-CURRENT-STATE.md`](./DASHBOARD-CURRENT-STATE.md).

**Ownership note:** this app does not own SAP schema or target data-architecture decisions — `hyrax-data-platform/docs/sap-data-architecture-plans/` is the source of truth for what data exists/will exist and how it's modeled. This doc assumes that repo delivers populated, correct tables, and focuses purely on what UI/dashboard work to do once they're available. It does name the app's own Supabase tables (`sales_leads`, `sales_targets`, `employees`, etc.) where the design is genuinely app-specific.

## 1. Salesperson identity & the dual-forecast model

### 1.1 The employee ↔ SAP-rep bridge

Two identities for "a salesperson" exist and must be bridged:

- **App side:** `employees.id` (uuid) with `employees.employee_id` (text — the human company employee code).
- **SAP side:** `sap_sales_persons.sales_rep_code` (bigint, SlpCode — the PK every `sap_*` order/invoice carries as `sales_rep_code`) and `sap_sales_persons.employee_id` (bigint, EmpID).

**The direct `employee_id`/EmpID join originally proposed here is confirmed broken — do not use it.** Three separate problems: a type mismatch (`employees.employee_id` is text, e.g. `"H004"`; `sap_sales_persons.employee_id`/EmpID is bigint); the SAP-side field is empty in production; and conceptually, SAP's `EmpID` is designed to reference SAP's own internal HR module (`OHEM`), which Hyrax doesn't run at all — so it could never hold a matching value even if populated.

**The real bridge: a dedicated `employee_sales_rep_mapping` table, auto-populated off `sap_sales_persons`** — a shared-key extension table (Kimball "mini-dimension"/outrigger pattern), not a hand-maintained one:

```sql
create table public.employee_sales_rep_mapping (
  sales_rep_code bigint primary key
    references public.sap_sales_persons (sales_rep_code),
  employee_id uuid unique
    references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill: one row per SAP rep that already exists.
insert into public.employee_sales_rep_mapping (sales_rep_code)
select sales_rep_code from public.sap_sales_persons
on conflict (sales_rep_code) do nothing;
```

```sql
-- Auto-create a row the moment OSLP's sync sees a brand-new rep.
create or replace function public.fn_auto_create_sales_rep_mapping()
returns trigger language plpgsql as $$
begin
  insert into public.employee_sales_rep_mapping (sales_rep_code)
  values (new.sales_rep_code)
  on conflict (sales_rep_code) do nothing;
  return new;
end;
$$;

create trigger auto_create_sales_rep_mapping
  after insert on public.sap_sales_persons
  for each row execute function public.fn_auto_create_sales_rep_mapping();
```

Two deploy steps, both hand-pasted into Supabase's SQL editor same as everything else here: the table + backfill are `hyrax-data-platform/infrastructure/employee_sales_rep_mapping_migration.sql`; the trigger is its own file, [`supabase/triggers/auto_create_sales_rep_mapping.sql`](../supabase/triggers/auto_create_sales_rep_mapping.sql), grouped with this app's other deployable SQL the same way `supabase/sql_editor/` holds the RPCs — run the migration first, then the trigger file. `sales_rep_code` is the PK — shared with `sap_sales_persons` by construction, guaranteed via the FK — so **every SAP rep automatically gets a mapping row**, including reps who aren't Hyrax employees at all (their `employee_id` just stays null); no one has to remember to create or backfill a row for a new or existing rep. The only manual step left is assigning/changing `employee_id` on an existing row once a rep is confirmed to be an employee — still via Supabase's table editor, same as `sales_targets`/`sales_budgets`; a picker on the Employee edit form is a Group B follow-up, not built now.

`sap_sales_persons`'s other fields (`sales_rep_name`, `commission_pct`, etc.) are deliberately **not** mirrored into this table — those are mutable, and duplicating them would need a second, `UPDATE`-side trigger to keep them in sync, with every future OSLP column addition needing that trigger updated too. Only `sales_rep_code` (the immutable shared key) needs to live in both tables, and it's only ever inserted, never changed after the fact. Anything needing `sales_rep_name` still joins `sap_sales_persons` directly, same as before.

**Join path to transactional tables (single hop through the mapping table):** `employees.id` → `employee_sales_rep_mapping.employee_id` → `employee_sales_rep_mapping.sales_rep_code` → directly usable against `sales_rep_code` on `sap_sales_orders`/`sap_invoices`/`sap_sales_persons`.

**Design rule:** SAP-based rep metrics are computed keyed by `sales_rep_code` (what orders/invoices carry), then joined out through `employee_sales_rep_mapping` to bring in `employees`/`profiles` **only** for display (name, avatar, department) — never for the attribution math. `sap_sales_persons` is joined separately, only for `sales_rep_name`.

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

### 1.4 Sales Leads architecture — resolved 2026-08 (hybrid of Path A/B)

Previously framed as two paths with the decision deferred — reproduced below for history, then the actual resolution.

**Path A — Evolve + bridge.** Keep Supabase `sales_leads` as pipeline system-of-record; add the bridges above. CRM stays authoritative for pipeline, SAP for realized revenue.

**Path B — Re-platform on SAP.** Key leads off `sap_customers`/`sap_sales_persons` directly, deprecating the manual `clients` upload.

**Resolution: neither path alone — the dual-identity reconciliation problem this decision was gated on (`clients.sap_bp_id` ↔ `sap_customers.customer_code`) did become a real pain, confirmed with live data** — a SAP export sitting in `hyrax-data-platform` confirms `sap_customers.customer_name` is not unique (one company spans 70+ `customer_code`s, branch-driven), and `sap_bp_id` was a free-typed text field with no FK, no validation, no lookup at all. Full re-platforming (pure Path B) was rejected: requiring every lead to already have an SAP customer code would mean salespeople couldn't log a lead until it's nearly a closed deal, since SAP customer records are typically only created once a transaction is imminent — that breaks the CRM's actual purpose (tracking pipeline *before* a transaction exists) and contradicts why this CRM exists in the first place (`CLAUDE.md`: "SAP has no leads workflow, so this is the permanent system of record for that process").

**What was actually built:** `clients` stays the pipeline-side entity (Path A's shape), but the bridge itself is fixed to Path B's rigor:
- `clients.sap_bp_id` renamed to `sap_customer_code`, given a real `FOREIGN KEY REFERENCES sap_customers(customer_code)` (see `hyrax-data-platform/infrastructure/clients_sap_customer_link_migration.sql`), and can only be set via a disambiguated search-and-pick UI (`sapCustomerSearch.js` + a custom `formatOptionLabel` showing `customer_code — customer_name`, then `city · contact_person · phone`) — never free text, never a name-only guess.
- A client with `sap_customer_code IS NULL` is an explicit, first-class **Prospect** state (not an error/blank) — a genuine lead with no SAP relationship yet. A client with it set is **Linked**.
- **Once Linked, SAP becomes authoritative for display** — name/phone/contact/city are read live from the joined `sap_customers` row everywhere in the UI (`ClientSidebar.jsx`, `ClientsList.jsx`), not the native `clients` columns, so there's no second copy left to go stale.
- `client_contacts` (Contacts) was retired entirely in the same pass — see §6 decision #7 below.

This resolves the "dual-identity" pain at the *link* level (validated, disambiguated, never by name) without sacrificing the Prospect state the CRM needs to function.

**Superseded 2026-08 — the SAP link moved off `clients` onto `sales_leads` directly.** The Linked-client model above created its own redundancy in practice: `clients.sap_customer_code` had no dedup (creating a new client and linking it to an SAP customer never checked for an existing row already linked to that code), and once linked a `clients` row carried no authoritative data of its own — it existed purely as a proxy so `sales_leads.client_id` (the only FK anywhere in the two-repo estate referencing `clients.id`) had something to point at. Resolved by moving the link one level down: `sales_leads` gained its own nullable `sap_customer_code` (FK to `sap_customers.customer_code`), `client_id` became nullable, and a `CHECK (num_nonnulls(client_id, sap_customer_code) = 1)` constraint enforces that a lead references **exactly one** of a real SAP customer or a native Prospect — never a `clients` row mirroring an SAP customer. `clients` is now prospect-only (its `sap_customer_code` column/FK were dropped); every previously-Linked client row was repointed and deleted by `hyrax-data-platform/infrastructure/sales_leads_sap_customer_link_migration.sql`. The Lead form's picker (`leadAccountSearch.js`/`LeadAccountEditor.jsx`) now searches SAP customers and Prospects together, with an inline "+ Create new prospect" affordance — so "Add Lead" and "Add Client" collapsed into one entry point (the Leads List page's separate "Add Client" button was removed).

## 2. Per-department Reports pages — what to build

### 2.1 Sales Reports _(Tier 3 — already built, redesigned 2026-07; previously a Looker iframe)_

Audience: Sales Manager + execs, monthly/quarterly. Core question: is the department hitting both its pipeline and invoiced-revenue forecasts, where is growth/risk concentrated, and is enough still in the pipeline to cover what's left of the target? Built: pipeline attainment (Forecast 1), invoice-budget attainment (Forecast 2, `sales_budgets`), order book, realized-vs-pipeline revenue (labeled as two systems of record, never blended), win rate/deal size/cycle time, product-type mix, lead-source ROI, top clients, gross profit by rep — plus, resolved 2026-07 (§5 Duality A), the company's actual sales-review view: PO (sales order) vs Invoice vs Budget variance per rep.

**Redesign — done (2026-07).** The 4-tile headline row is now 8 tiles, following the same "~7 headline numbers"/"what → so what → now what" methodology already applied to Finance Reports, telling doc-02's own Sales Story directly ("Where are deals in the pipeline, will we hit target, and are we fulfilling what we sold?") in two blocks: **Pipeline & Conversion** (CRM-side, forward-looking) — Pipeline Attainment, Pipeline Coverage (new — fills doc-02's previously-unrepresented "pipeline value & coverage ratio" bullet, `activePipelineValue`/`pipelineTargetRevenue`), Win Rate (promoted from a buried Order Book sub-metric to its own tile), Pipeline Velocity (new, synthesized — opportunities × avg deal size × win rate ÷ avg cycle days); **Execution, Bookings & Concentration** (SAP-side, backward-looking) — Sales Cycle, Invoice Budget Attainment, Order Book, Customer Concentration (new — top-5 clients' share of won revenue). Also added a Pipeline Stage funnel chart (doc-02 explicitly calls for one; this page previously had zero stage-composition view — built via the same horizontal-bar-renderer substitution technique Leads Overview already uses for its own funnel) and a SAP-only Bookings vs Invoiced Revenue trend chart (orders booked vs. invoices billed, trailing 12 months). See `RPC-REFERENCE.md` and `DASHBOARD-CURRENT-STATE.md` §5 for the full field/formula detail.

**Remaining gaps (backlog):** OTIF and return/credit-memo rate (both in doc-02's Sales KPI list) remain blocked — OTIF needs Production (`OWOR`) extraction, not yet synced into Supabase (`OITW`, the other half of OTIF's data need, was extracted 2026-08 for Finance Expansion Phase 4 — available whenever this KPI is actually built, just not wired up as part of that Finance-focused work); credit-memo rate needs `ORIN`/`RIN1`, also not yet synced. A rep/region performance cut is deferred pending verification that `sap_customers`/`clients` region fields are reliably populated — not built speculatively. No AI Summary or period-over-period delta on this page yet (both present elsewhere in the app).

### 2.2 Finance Reports _(Tier 3 — already built; design in the missing pieces)_

Already live: Revenue Invoiced, Cash Collected, Outstanding AR/DSO, Overdue Risk, AR Aging, Revenue Trend, Top Overdue Customers, Salesperson Health, Top Customers, (**added 2026-07, Finance Expansion Phase 1**) the full AP mirror — Bills Received, Cash Paid, Outstanding AP, Overdue Payables, AP Aging, Top Overdue Vendors, Top Vendors by Spend, Unallocated Outgoing Payments, DPO — and (**added 2026-07, Finance Expansion Phase 2**) a real General Ledger extraction powering this dashboard's first true P&L (Net Profit, Net Profit Margin, an approximate EBITDA/EBITDA Margin, a P&L breakdown chart) and balance-sheet figures (Current Ratio, Quick Ratio, Working Capital, Total Assets/Liabilities/Equity, a balance sheet snapshot chart) computed from actual GL postings rather than subledger proxies. New Bills/Vendor Payments list pages shipped alongside Phase 1. **Phase 2 follow-up passes (2026-07):** a `kpi_totals` performance rewrite (single-pass `FILTER` aggregates, cutting a 20-25s filterless load down); YoY comparisons (Net Profit/Revenue/Gross Profit vs. same fiscal-year-period last year, distinct from the existing period-over-period deltas), a P&L Trend chart, and an Operating Expense Breakdown chart; a fix excluding SAP's own period-end closing entries (`trans_type = -3`) from all P&L figures, so a fiscal year SAP has formally closed no longer shows a misleading `RM 0`; and the two new General Ledger list pages, Journal Entries and Chart of Accounts (closing out the "genuine list-page gap" this section used to flag). **KPI/Gross-Profit restructure — done (2026-07, Pass 1).** The 14-tile headline row (grown across four Phase additions with no top-down redesign) is now 8 tiles, following the "~7 headline numbers"/drill-down methodology in `03-executive-dashboard-framework.md`: Revenue Invoiced, Gross Profit, Net Profit, EBITDA (Profitability), then Cash Collected, Overdue Risk, Cash Cycle (new — synthesizes `dso`/`dpo`), Working Capital (Liquidity/cash). The `periodGrossProfit` (invoice-based) vs. `glGrossProfit` (GL-based) mismatch is resolved for the headline UI: `glGrossProfit` is now the tile (structurally matches the target framework's formula, keeps the headline row internally GL-consistent), `periodGrossProfit` demoted to a sub-metric on the same tile (still load-bearing for Salesperson Health's per-rep breakdown) — both figures stay computed server-side, this was a UI-priority decision, not a calculation change. Six tiles demoted (not deleted, each subsumed by an existing chart); the `netArApPosition` **tile** removed outright (superseded by Working Capital by its own former tooltip's admission) — the field itself stays live, still referenced inside the Working Capital tile's own tooltip. See `06-finance-expansion-execution-plan.md` for the full before/after tile-disposition table.

**DIO and the full Cash Conversion Cycle — built (2026-08, Phase 4).** The Cash Cycle tile now shows `DSO + DIO − DPO`, with DIO/DPO as sub-metrics. GL-derived (`glInventoryBalance`/`glPeriodCOGS`, the GL's "2000 Inventories" balance already live since Phase 2) — **not** sourced from SAP's `OITW` table, which was also extracted this phase (`sap_item_warehouse_stock`) but is a per-warehouse quantity table only; its own cost fields aren't confirmed populated for Hyrax, so it wasn't used as this KPI's source. See `06-finance-expansion-execution-plan.md`'s Phase 4 for the full reasoning.

Remaining to design in (contract-first, even if null-filled until data lands): a net-of-returns caveat/net revenue figure (blocked on Returns/Credit-Memo extraction); a DSO/DPO/DIO trend line, needing a non-trivial new historical-balance derivation deserving its own focused build, still deferred. State plainly in the UI going forward: Finance now has a true P&L, balance sheet, full Cash Conversion Cycle, and a right-sized headline scorecard; the DSO/DPO/DIO trend chart is the remaining gap.

**Cash Flow Statement — promoted out of backlog and into its own phase, built (2026-08).** What used to be logged here as "an approximate Operating Cash Flow waterfall, deferred to Pass 2" is now **Phase 3** in `hyrax-data-platform/docs/sap-data-architecture-plans/06-finance-expansion-execution-plan.md`, live at `finance/cash-flow` plus a chart section on this page. SAP B1's own dedicated Cash Flow Categories module (`OCFW`/`OCFT`) was investigated and ruled out (6 empty placeholder rows, last touched 2021) — built GL-derived instead. Two rounds of live-tested follow-up fixes shipped after real reconciliation drift surfaced (a genuine interest-bearing loan category swept into the wrong bucket, then SAP's period-end closing entries and depreciation both double-counting) — see that doc's Phase 3 for the full history. **Balance Sheet — built (2026-08, Phase 5)**, same investigation, same day: the existing 4-bucket balance-sheet summary now has a full line-item Statement of Financial Position behind it at `finance/balance-sheet`. **Income Statement — built (2026-08, Phase 6)**: the existing GL P&L figures now have a proper statement page at `finance/income-statement` (Revenue → COGS → Gross Profit → OpEx → Operating Profit → Other Expenditure → Tax → Net Profit, plus EBITDA), with `viewAllTo` links added on both the Balance Sheet Snapshot and P&L Breakdown cards on this page — closing a parity gap Balance Sheet had briefly shipped without. **Statement of Changes in Equity is the one remaining statement**, confirmed feasible from data already extracted, not yet built. AR/AP aging composition strips (reusing the existing `StackedBarRenderer`, zero backend change) remain a small, independent follow-on, not blocked by any of the above.

**Fiscal Year filter rollout (2026-07):** the April-March Fiscal Year filter, previously Finance-Reports-only, now also appears on Payments, Vendor Payments, Sales Reports, and Operations Reports — a pure drop-in everywhere, since the filter component is self-contained and every target page's query already consumed a date range.

**Execution plan (2026-07, phase numbering updated 2026-08) — all phases now built.** The full phased build-out — Accounts Payable chain (**Phase 1, done 2026-07**), General Ledger (**Phase 2, done 2026-07**, plus the follow-up passes above), a Cash Flow Statement (**Phase 3, done 2026-08**, plus two rounds of live-tested follow-up fixes), per-warehouse inventory valuation / DIO / Cash Conversion Cycle (**Phase 4, renumbered from Phase 3 in 2026-08, done 2026-08** — GL-derived, decoupled from the OITW extraction it also shipped, see above), a Balance Sheet (**Phase 5, done 2026-08**), and an Income Statement (**Phase 6, done 2026-08**, Statement of Changes in Equity confirmed feasible but not yet built) — plus an early DSO-formula reconciliation (**Phase 0, done 2026-07**) and new list pages for the new entities (**done alongside Phase 1, and again as a Phase 2 follow-up**) — is tracked in `hyrax-data-platform/docs/sap-data-architecture-plans/06-finance-expansion-execution-plan.md`, with a streamlined full-picture summary at that same folder's `07-finance-expansion-summary.md`. That doc owns the SAP table/column/schema decisions and phase sequencing per this repo's usual governance split; update its per-phase "Status" line as work lands. All phases' RPC and migrations are deployed — confirmed 2026-08.

### 2.3 Operations & Fulfilment Reports _(Tier 3 — new; strongest launch candidate)_

Audience: Operations/Supply-Chain Manager, daily standup + weekly. Content: open order backlog, undelivered units, on-time delivery (vs. request and vs. internal promise), fill rate, fulfilment cycle time, backlog aging, shipment volume trend, aggregate stock cover. **Per-warehouse stock detail's data now exists** (`sap_item_warehouse_stock`/OITW, extracted 2026-08 for Finance Expansion Phase 4) but isn't wired into `get_operations_dashboard_rpc.sql`'s `stockPositionData` yet — see `RPC-REFERENCE.md`. Inbound-ETA remains blocked pending data-platform delivering the PO chain (`OPOR`/`POR1`/`OPDN`/`PDN1`).

### 2.4 Production & Plant Reports _(Tier 3 — new; mostly blocked today)_

Audience: Production/Plant Manager, daily shift + weekly. Honest framing: almost nothing about actual production is buildable today — launch content is demand-/inventory-side proxies (committed demand from open order lines, replenishment candidates, shipped-volume-as-throughput-proxy), clearly labeled as proxies, not true output. Real output/yield/cost-variance is gated behind data-platform's production-core extraction, itself gated behind a scoping spike confirming Hyrax actually books well-populated production orders + BOMs in SAP. Don't wait for that spike to ship the demand/inventory proxy panel, but don't build the output/yield panel before it either.

### 2.5 Procurement & Payables Reports _(Tier 3 — new; mostly blocked)_

Audience: Procurement Manager + AP/Finance, weekly review + daily/weekly AP-due list. Core question: what have we committed to buy, is it arriving on time, what do we owe and when? **Partially unblocked as of 2026-07**: the AP-aging/DPO half of this ("what do we owe and when") is now real data, live on Finance Reports (`sap_vendor_bills`/`sap_vendor_payments`, Finance Expansion Phase 1) — `outstandingAP`, `dpo`, `apAgingData`, `topOverdueVendorsData`, `topVendorsBySpendData` all already exist in `get_finance_dashboard`. What's still blocked: the purchasing-commitment half ("what have we committed to buy, is it arriving on time") needs the vendor-PO chain (`OPOR`/`POR1`, GRPO `OPDN`/`PDN1`) — none of that is extracted. **Don't ship a supplier-master-only stub page** — define the full RPC contract now (this can reuse Finance's already-built AP-aging/DPO CTEs directly rather than re-deriving them; supplier OTIF = customer OTD still needs the PO/GRPO chain) and build the React page once the PO-side data lands.

### 2.6 IT & HR — explicitly parked

**IT:** Assets Overview already exists and is sufficient for a single-user function. Defer a Tier-3 "IT Reports" page until Software Management has a real data model to synthesize against.

**HR:** Hold HR Reports until the HR2000-integration direction is settled (the HR module was built app-native before that integration was considered) — building now risks rework once HR2000 reshapes the data model.

## 3. Executive Summary dashboard _(Tier 4 — how each department flows up)_

Built the same way as every other Reports page: one `get_executive_dashboard` RPC + the shared components. Each department contributes 1–3 headline numbers:

| Department  | Rollup metric(s)                                                       |
| ----------- | ---------------------------------------------------------------------- |
| Sales       | Pipeline attainment % + invoice-budget attainment % + order book value |
| Finance     | Revenue invoiced, cash collected, outstanding AR, DSO, collection rate |
| Operations  | Open order backlog value + on-time-delivery %                          |
| Production  | Output volume + yield % (interim: committed-demand backlog)            |
| Procurement | Open-PO commitment + AP due                                            |

**The ceiling to state up front:** a true department-level P&L or cost allocation is still blocked — but only by one thing now, not two. GL data itself landed 2026-07 (Finance Expansion Phase 2, `get_finance_dashboard`'s `netProfit`/`ebitda`/balance-sheet figures) — that blocker is resolved, and a company-wide P&L rollup for this Executive Summary is now buildable. What's still missing: a department/cost-center dimension on any `sap_*` table, so the _company-wide_ P&L can't yet be sliced _by department_. HR/IT/Sales app-side data _can_ be sliced by department (`employees.department_id`); SAP-sourced financials still can't, until a cost-center mapping exists.

## 4. Prioritized punch-list

### Group A — IA/navigation fixes _(cheap, days not weeks)_

- Fix the FIN/SAL access-control mismatch on Finance Invoices.
- Fix HR Employees Overview's two mislabeled KPI cards.
- Fix or remove the broken `hr/reports` nav link.
- Rename "IT Dashboard" away from the word "Dashboard."
- ~~Resolve the Quotations orphan-route contradiction.~~ _Resolved 2026-08 — not a bug._ Confirmed with the user: `sales/quotations` is an intentional placeholder for a future in-app quotation-_generation_ feature, unrelated to SAP. Hyrax doesn't use SAP's own quotation module (`OQUT`/`QUT1`) — same "feature exists in SAP, never turned on" pattern as `OCFW`/`OCFT`/`OPRC`/`OFAA` elsewhere in this app's SAP estate. Route/nav comments updated to say so explicitly; no code changes to the route itself.
- ~~Add a dual-labeling disclosure on Leads Overview + Finance Salesperson Health (§5 below) — the CRM-vs-ERP duality (still open; distinct from the orders-vs-invoices duality resolved 2026-07, see §5).~~ **Done 2026-08.** Leads Overview's headline tile relabeled "Pipeline Attainment (CRM)" with a tooltip disclosure; its per-rep scorecard section retitled "Sales Performance Scorecard (CRM)" with a matching subtitle; Finance's Salesperson Health chart subtitle now explicitly calls out it's SAP-recognized, distinct from the CRM figure. See §5 below.

### Group B — New feature builds _(real scope, needs its own sequencing)_

- Build Attendance Overview (flagship — do this first; see `DASHBOARD-CURRENT-STATE.md` §2 HR).
- ~~Build Clients Overview.~~ **Resolved 2026-08 — removed instead.** It was a literal empty stub with no scope beyond this one-liner; the blended Prospect+SAP-customer analytics it would have shown (top accounts, industry mix) already live in Leads Overview and Sales Reports, so a third dashboard would have fragmented that story rather than added to it. Confirmed with the user. A read-only **SAP Clients** list (`sap_customers`, same pattern as Finance's Chart of Accounts) was added to the Clients tab in the same pass — see `DASHBOARD-CURRENT-STATE.md`.
- Build an employee-picker on the Employee edit form for `employee_sales_rep_mapping.employee_id` — promoted here 2026-08 from an inline aside in §1.1; today the only way to link an auto-created SAP-rep mapping row to a real employee is Supabase's own table editor, no in-app UI.
- ~~Build native Sales Reports, retiring the Looker iframe~~ — **done**, then redesigned 2026-07 (see §2.1).
- Build HR Reports (after the HR2000 direction settles).
- ~~Fold Quotations into Leads as a List-only tab, or formally retire it.~~ _Resolved 2026-08 — neither._ Confirmed with the user: keep the standalone `sales/quotations` route/page as-is, as an intentional placeholder for a future native in-app quotation-generation feature. Not a Sales-side SAP extraction target (`OQUT`/`QUT1` investigated and ruled out — see `hyrax-data-platform/docs/sap-data-architecture-plans/08-sales-expansion-execution-plan.md`).
- Re-enable Finance's commented-out AI Summary.
- Fix `it_assets.purchase_cost`/`warranty_expiry` column types (currently `text`, not `numeric`/`date`), then add the cost/warranty KPIs — migrate + backfill first, don't inline-cast as a shortcut.
- Activate Leave — after Attendance Overview + HR Reports v1, and after confirming timing against the HR2000 roadmap.
- Build Executive Summary — once departmental Reports pages are solid.

### Group C — Data-correctness fixes _(needs `hyrax-data-platform` alignment first)_

- ~~`get_finance_dashboard_rpc.sql`'s payment-application join implemented an old, disputed RCT2→invoice assumption~~ — **resolved**: the RCT2→invoice FK (`doc_entry`, filtered `inv_type = 13`, not `inv_entry`) is now confirmed and the RPC's join has been updated to match (see `hyrax-data-platform/docs/data-dictionary.md`'s "RCT2 → invoice link"). Remaining follow-up: **redeploy the updated RPC via Supabase Studio's SQL editor** if not already done (no CLI/migration is wired up — manual deploy step), and consider a small follow-up feature to actually resolve/display a real `invoice_number` in the Payments detail UI (`fetchPaymentApplications.js`/`paymentApplicationsTableConfig.jsx` currently show `inv_entry`/`doc_entry` raw, since the FK was unconfirmed when they were built) — now unblocked, not yet built.
- ~~Finance Reports' `salesRepRevenueData` summed `sap_sales_orders` while Sales Reports' per-rep figures summed `sap_invoices` — same nominal "revenue by rep," two different SAP documents, silently disagreeing~~ — **resolved 2026-07**: Finance's per-rep chart now sums `sap_invoices` (matching Sales Reports' `rep_invoice_actuals` by construction) and adds `collected_myr` per rep; the order-side view lives entirely in Sales Reports' `invoiceBudgetScorecardData` as a PO-vs-Invoice-vs-Budget variance table (per the company's actual sales-review process). See `DASHBOARD-CURRENT-STATE.md` §5/§6 and `RPC-REFERENCE.md`. Remaining follow-up: **verify the live deployed `get_finance_dashboard` and `get_sales_reports_dashboard` match these repo `.sql` files** — if filtering Finance Reports by salesperson still zeros out `collected_myr`/`totalCollected` for most reps after this redeploy, the RCT2-join redeploy above likely hasn't landed either; re-check both together.
- ~~The `employees` ↔ `sap_sales_persons` reconciliation mapping was going to be a one-time data check on SAP's EmpID field~~ — **redesigned**: EmpID is confirmed unusable (see §1.1), replaced with the `employee_sales_rep_mapping` bridge table (auto-populated per SAP rep via trigger). Remaining follow-up: **run the migration** (`hyrax-data-platform/infrastructure/employee_sales_rep_mapping_migration.sql`, then `supabase/triggers/auto_create_sales_rep_mapping.sql`) in Supabase, then assign `employee_id` on the auto-created rows for reps who are Hyrax employees, via the table editor.
- Wire the dead `sales_orders` bridge table (§1.3).
- ~~Reconcile the DSO methodology mismatch between this app's live point-in-time formula and the target KPI framework's average-AR formula~~ — **resolved 2026-07** (Finance Expansion Phase 0.1, see `hyrax-data-platform/docs/sap-data-architecture-plans/06-finance-expansion-execution-plan.md`): `get_finance_dashboard`'s `dso` now computes Avg AR from Ending AR (`outstandingAR`) via the accounting identity `Beginning AR = Ending AR − periodInvoiced + totalCollected` (clamped at 0), matching the target KPI framework's average-AR methodology — no historical AR snapshot was needed. See `DASHBOARD-CURRENT-STATE.md` §6 and `RPC-REFERENCE.md` for the full formula. Remaining follow-up: **redeploy the updated RPC via Supabase Studio's SQL editor** (no CLI/migration wired up — manual deploy step, same as every other RPC change here).

## 5. Salesperson performance — two dualities, one resolved

There were actually **two** structurally distinct "salesperson revenue" disagreements living in this app. Keep them separate — they have different root causes and different fixes.

**Duality A — orders vs. invoices, both SAP-sourced (resolved 2026-07).** Finance Reports' "Salesperson Health" chart used to sum `sap_sales_orders.total_amount_myr` (order-booked, scoped by `order_date`) while Sales Reports' per-rep figures summed `sap_invoices.total_amount_myr` (invoiced, scoped by `invoice_date`) — same nominal metric, two different SAP documents, silently disagreeing for the same rep/period. Root cause and fix: per the company's actual sales-review process (comparing sales orders/PO, invoices, and budget is the _sales_ team's job, not Finance's), ownership was reassigned rather than just labeled — **Sales Reports** now owns the full PO-vs-Invoice-vs-Budget variance per rep (`invoiceBudgetScorecardData`, extended with `order_value_myr`/`po_vs_budget_variance_myr`/`po_vs_invoice_variance_myr`), and **Finance Reports**' per-rep chart switched to invoiced revenue + cash collected (`salesRepRevenueData`, now invoice-sourced with a new `collected_myr` field) — matching Finance's actual AR/cash mandate and, as a side effect, agreeing exactly with Sales Reports' invoice figures for the same rep/period. See `DASHBOARD-CURRENT-STATE.md` §5/§6 and `RPC-REFERENCE.md` for the exact formulas.

**Duality B — CRM vs. ERP, still open.** The CRM scorecard (`sales_leads.actual_revenue`, manually typed, forward-looking, keyed by `lead_owner_id`, on Leads Overview) vs. SAP-recognized revenue (backward-looking, keyed by `sales_rep_code`, now living on both Sales Reports and Finance Reports per Duality A above). This one is normal for CRM+ERP run side by side — CRM is a forecasting/coaching signal, ERP-recognized revenue is the only one that should be compensation-bearing — and is **not** a bug to fix by unifying the numbers.

**Now (zero data-model work) — done 2026-08.** Don't silently pick a winner for Duality B. Leads Overview's headline tile relabeled "Pipeline Attainment (CRM)" (was "Revenue Attainment") with a tooltip disclosure; its per-rep scorecard section retitled "Sales Performance Scorecard (CRM)" with a matching subtitle; Finance's Salesperson Health chart subtitle updated to state it's SAP-recognized (`sap_invoices`), distinct from the CRM figure. Both views use different identity keys and revenue definitions and may legitimately disagree — that's now stated in-UI, not just here.

**Later:** build the identity bridge (§1.1, done — `employee_sales_rep_mapping`), wire the dead `sales_orders` bridge (§1.3), decide the canonical revenue definition for compensation (open decision below), then surface one attainment number at both cadences.

## 6. Open decisions — the user's calls, not derivable from best practice

1. ~~Sales Leads architecture — Path A vs Path B (§1.4).~~ **Resolved 2026-08, then superseded 2026-08 same month** — the hybrid Linked-client model (validated FK + disambiguated search, SAP-authoritative once linked) worked but left a redundant `clients` proxy row per linked SAP customer with no dedup; the SAP link was moved off `clients` onto `sales_leads.sap_customer_code` directly instead, with `clients` now prospect-only. See §1.4 for the full writeup of both passes.
2. Canonical revenue definition for the invoice-budget scorecard and for compensation — order-booked vs. invoiced vs. collected; CRM self-reported vs. SAP-recognized. Finance/business-policy call.
3. Production: pursue SAP OWOR extraction vs. wait for the Plant IoT pipeline (§2.4) — answer via the scoping spike on Hyrax's live SAP data.
4. HR dashboarding timing — held until the HR2000-integration direction is decided (§2.6).
5. Whether Recruitment/Performance/Claims/Software Management data models are worth building at all right now, vs. deferring indefinitely.
6. Whether existing license-visibility tools (ManageEngine, vendor portals) already cover what a bespoke Software Management schema would provide.
7. ~~Whether Contacts warrants a standalone cross-client directory vs. staying embedded-per-client only.~~ **Resolved 2026-08** — retired entirely. SAP's own contacts table (OCPR) was confirmed never extracted and won't be; the CRM's `client_contacts` solved a different problem (who to call) than customer identity, and the user chose to drop the scope (Leads' pipeline should stay simple) rather than maintain it. `client_contacts` table, `sales_leads.client_contact_id`, the Contacts tab/page/route, and all related services were removed in the same pass as decision #1.
8. Whether to expand Leads Overview's Lead Stages chart past WON/LOST to visualize post-Won fulfillment (Sales Order Created → In Production → Delivered → Invoiced), or keep the CRM pipeline stopping at WON/LOST and surface fulfillment separately in Operations Reports (§2.3, already built off live SAP order/delivery/invoice data) and Production Reports (§2.4, blocked on decision #3's OWOR spike) — **deferred 2026-08.** Sales order/delivery/invoice data already exists live in Supabase today, so the "Sales Order Created/Delivered/Invoiced" legs *could* be built now, but "In Production" specifically has no data at all yet. Rather than build a partial chart with a permanently-empty stage, the user chose to leave the Leads pipeline CRM-only for now and revisit this placement question once decision #3's production-pipeline spike resolves and the full post-Won data set is actually available.

# Dashboard Information Architecture & KPI Strategy

_A grounded reference for how pages, dashboards, and reports should be structured across Hyrax Central Portal, and what data currently supports (or blocks) each one. Every claim below is cited to a real file in `hyrax-central-portal` or `hyrax-data-platform` — nothing here is aspirational unless explicitly labeled as a gap or a future item._

> **Companion doc:** this document covers **page structure and naming conventions** (List / Overview / Reports / Executive) plus a current-state audit. For the department-by-department plan of _what each Reports page contains, which SAP tables feed it, and in what order to build them_, see [`DEPARTMENT-DASHBOARD-BLUEPRINT.md`](./DEPARTMENT-DASHBOARD-BLUEPRINT.md) — that is the authoritative build-planning reference.

---

## 1. Executive summary

The confusion that prompted this document isn't really a Sales-vs-Finance problem — it's that the word **"Dashboard"** is currently doing three unrelated jobs in this app at once:

1. A portal home-screen / quick-launcher (Quick Actions, announcements, external tool links).
2. A rebadged external BI iframe (Sales > Reports embeds Google Looker Studio).
3. A real native analytics page (Finance > Reports, Sales > Leads > Overview).

Once those three meanings are split apart and each is given exactly one name, the "what's an Overview, what's a Reports page" question mostly answers itself:

- **List** = the table you work out of every day (a lead, an invoice, an asset). Operational, row-level, daily use.
- **Overview** = "how is _this one thing_ (Leads, Clients, Assets, Employees…) doing" — scoped to a single entity/submodule, used by the team running it and their direct manager, checked often.
- **Reports** = "how is _the whole department_ doing" — synthesizes across that module's entities, used by the department head at weekly/monthly cadence. Never just one entity's Overview relabeled.
- **Executive Summary** (doesn't exist in the app yet) = "how is _the whole company_ doing" — synthesizes across departments, for leadership. `hyrax-central-portal/CLAUDE.md` already names this as the long-term target: _"the target is real-time dashboards for every department and for executives."_ This document treats it as the natural Tier 4, not something to retrofit into an existing Reports page.

Applying that consistently resolves the page-structure questions. But the second half of this document exists because good IA doesn't matter if the data underneath can't support it — so §4 and §5 answer, directly and with evidence, whether the current SAP extraction and app schema can actually deliver company-wide dashboards, before §8 proposes what to build.

**Headline answers, if you read nothing else:**

- Sales and Finance's page-structure mismatch is _not_ actually inconsistent where it looks like it is (see §6) — the real inconsistency is a handful of concrete bugs and unbuilt stubs (§3), not a structural flaw.
- The SAP data extracted today (11 tables) is **not enough** for true company-wide financial or operational reporting — no general ledger, no production data, no purchasing/AP visibility (§4).
- HR, IT, and Sales/CRM already share one clean identity backbone and **can** be joined into a cross-department view today. Finance/SAP data is a data island that **cannot** be sliced by department yet (§5).
- A full KPI/chart catalog for every dashboard — tagged by whether it's buildable today, needs wiring, or is blocked on new data — is in §8.

---

## 2. Industry-standard tiering framework

BI/SaaS products almost universally separate reporting surfaces into four altitudes. Names differ by vendor, the shape doesn't:

| Tier | Generic name                      | Salesforce                                                | HubSpot                                   | NetSuite                   | Audience / cadence                                              |
| ---- | --------------------------------- | --------------------------------------------------------- | ----------------------------------------- | -------------------------- | --------------------------------------------------------------- |
| 0    | Record detail                     | Object detail page                                        | Record page                               | Record view                | Whoever owns that one record; as-needed                         |
| 1    | **List**                          | List Views                                                | Index (table) views                       | Search Results / Lists     | Individual contributor; daily, operational                      |
| 2    | **Entity/submodule Overview**     | Object-scoped reports (e.g. Opportunity pipeline reports) | Deals board + built-in object reporting   | Record-type KPI scorecards | The team running that entity + their line manager; daily/weekly |
| 3    | **Module/Departmental "Reports"** | Sales Cloud Home / Forecasts                              | Dashboards (curated, cross-object canvas) | Role-based Dashboards      | Department manager/director; weekly/monthly                     |
| 4    | **Executive / cross-module**      | Org-wide executive dashboards                             | Cross-hub dashboards                      | Executive Center           | C-suite/leadership; monthly/quarterly                           |

This maps onto Stephen Few's classic operational/tactical/strategic dashboard taxonomy: **Tiers 0–1 are operational** (real-time, row-level, drill-heavy, no synthesis needed), **Tier 2 is tactical/analytical-but-single-domain** (aggregated, filterable, never mixes unrelated entities), and **Tiers 3–4 are strategic** (low-refresh, headline-KPI, cross-entity synthesis, built to be read in five seconds).

**The rule that resolves most of the confusion in this app:**

> Tier 2 (Overview) never gets bigger by absorbing another entity's data — it gets deeper. Cross-entity synthesis only happens at Tier 3 (Reports) or Tier 4 (Executive).

A submodule's Overview should never try to be a mini-Reports page, and a Reports page should never just be one submodule's Overview relabeled.

---

## 3. Current-state audit

_Everything in this section was verified directly against the code — routes, page components, and in-code comments — not inferred._

### Sales (`src/routes/SalesRoutes.jsx`, `src/pages/user/sales/`)

| Page                                                     | State                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sales/reports` → `Reports.jsx`                          | **Not a native dashboard.** A bare `<iframe>` embedding a Google Looker Studio report — no KPIs, no charts from the app's own component library, doesn't even use the theme system. This is the Sales module's **default landing route** (index redirects here, not to Leads Overview).                                                                                       |
| `sales/clients/overview` → `ClientsOverview.jsx`         | Literal empty stub: `function ClientsOverview() { return <div>ClientsOverview</div>; }`.                                                                                                                                                                                                                                                                                      |
| `sales/clients/list` → `ClientsManagement.jsx`           | Fully built CRUD (SAP BP ID, name, address, industry; table/card view toggle; sidebar detail view).                                                                                                                                                                                                                                                                           |
| `sales/clients/contacts` → `ContactsManagement.jsx`      | Literal empty stub — even though full Contacts CRUD already exists, just embedded inside each client's detail sidebar instead of at this route.                                                                                                                                                                                                                               |
| `sales/leads/overview` → `LeadsOverview.jsx` (579 lines) | **The most mature page in the entire app.** A full native tiered dashboard: Tier-1 KPI cards (Active Pipeline, Pipeline Generated, Revenue Attainment, Lost Revenue), a per-rep "Sales Performance Scorecard" (quota progress bars), Tier-2 pipeline/funnel charts, Tier-3 historical trend charts, executive-style leaderboards, AI-generated executive summary, PDF export. |
| `sales/leads/list` → `LeadsManagement.jsx` (552 lines)   | Fully built CRUD with a lead-stage-transition workflow (DISCOVERY → SAMPLE_TEST → PROPOSAL → NEGOTIATION → WON/LOST), capturing `po_number`/`po_document_url`/`quotation_url`/`actual_revenue` as fields on a lead at the WON transition — manually typed by the rep, not pulled from SAP.                                                                                    |
| `sales/quotations` → `Quotations.jsx`                    | Orphan: route exists and is access-gated, but its sidebar nav entry is commented out (unreachable except by typing the URL), and the page itself is an empty stub.                                                                                                                                                                                                            |

Sales has **no dedicated Invoices, Purchase Order, or Targets-management submodule**. "Targets" exist only as a read-only backend RPC (`get_sales_targets_prorated`) consumed by Leads Overview — no in-app UI exists to create/edit them (must be done via raw SQL/Supabase table editor).

### Finance (`src/routes/FinanceRoutes.jsx`, `src/pages/user/finance/`)

| Page                                                   | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finance/reports` → `FinancialReports.jsx` (413 lines) | **Already correctly Tier-3 shaped.** Its own in-code comments literally read `TIER 1: THE HIGH-LEVEL SUMMARY` (line 219), `TIER 2: AR AGING & COLLECTIONS` (line 247), `TIER 3: SALESPERSON HEALTH & TOP CUSTOMERS` (line 342) — verified directly. Tier 1: Revenue Invoiced, Cash Collected, Outstanding AR/DSO, Overdue Risk. Tier 2: AR Aging, Top Overdue Customers, Collection Rate, Revenue Trend. Tier 3: Salesperson Health (revenue + GP per SAP rep, from `sap_sales_orders`) + Top Customers by Revenue. |
| `finance/invoices` → `Invoices.jsx` (129 lines)        | **Correctly Tier-1-only.** An in-code doc comment states plainly: _"Read-only invoices list -- SAP is the system of record, so there's no create/edit/delete here... This is the drill-through target for the Finance dashboard's KPI cards."_ No Overview needed — an Overview here would just re-derive the AR-aging/DSO content Finance Reports' Tier 2 already owns.                                                                                                                                            |
| `finance/payments` → `Payments.jsx`                    | Literal empty stub — `function Payments() { return <div>Payments</div>; }` — no backing data/hook layer at all.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `finance/claims-management` → `ClaimsManagement.jsx`   | Same shape: literal empty stub, no backing data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**A real bug, not just an IA nuance:** `FinanceRoutes.jsx` grants `finance/reports` to `departments: ["FIN", "SAL"]` managers, but `finance/invoices` to `["FIN"]` only. A Sales manager who can see Reports' KPI cards will get "Unauthorized" clicking through to the drill-through target those same cards link to. Fix this regardless of anything else in this document.

Finance has **no Purchase Order concept anywhere** — no vendor-PO extraction exists either, confirmed on the data-platform side (§4).

### HR (`src/routes/HRRoutes.jsx`, `src/pages/user/hr/`)

| Page                                                              | State                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hr/employees/overview` → `EmployeeOverview.jsx`                  | Fully built, but has **two real bugs**: the "Inactive Employees" KPI card is bound to `kpis.terminatedEmployees` (mislabeled — it's showing terminated count, not inactive count), and the "Average Team Size" card is bound to `kpis.employeesWithoutManager` instead of `kpis.avgTeamSize` (which the underlying hook already computes correctly but which this config file never reads). |
| `hr/employees/list` → `EmployeeManagement.jsx`                    | Fully built CRUD.                                                                                                                                                                                                                                                                                                                                                                           |
| `hr/attendance/overview` → `AttendanceOverview.jsx`               | Literal empty stub — `<div>AttendanceOverview</div>` — despite a rich, already-built biometric+app dual-source daily-attendance view (`unified_daily_attendance`) sitting completely unused at the aggregate level. See §8 — this is the single highest-leverage opportunity in this whole document.                                                                                        |
| `hr/attendance/list` → `AttendanceManagement.jsx` (467 lines)     | Fully built — daily-grouped views, approve/reject workflow, clock-out action, photo upload, anomaly badge.                                                                                                                                                                                                                                                                                  |
| `hr/departments`, `hr/leaves`, `hr/recruitment`, `hr/performance` | All flat literal stubs.                                                                                                                                                                                                                                                                                                                                                                     |
| `hr/reports` (nav link)                                           | **Broken, not just unbuilt.** The nav entry exists in `sideNavLinkData.js`, but `HRRoutes.jsx` has no matching `<Route path="reports">` at all — this is a dead link in production today. Sales and Finance both have a working Reports page; HR is the one core department missing it entirely, and the link itself is broken, not merely pointing at a stub.                              |

### IT (`src/routes/ITRoutes.jsx`, `src/pages/user/it/`)

| Page                                         | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `it/assets/overview` → `ITAssetOverview.jsx` | Fully built — 4 KPI cards (Total Assets, Active Assets, Risk Assets, Unassigned) + 7 charts (Category, Status, Condition, Risk-vs-Safe, Assigned-vs-Unassigned, Operating Systems, By Department).                                                                                                                                                                                                                                                                                                            |
| `it/assets/list` → `ITAssetManagement.jsx`   | Fully built CRUD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `it/software` → `SoftwareManagement.jsx`     | Pure stub — 4-line empty div. **No backing schema exists anywhere** for software/licenses — this is a data-model gap, not a dashboard gap.                                                                                                                                                                                                                                                                                                                                                                    |
| `it/dashboard` → `ITDashboard.jsx`           | Despite the name, **not an analytics page** — it renders only a `QuickActions` grid of external links (Google Admin Console, ManageEngine Endpoint Central's web console, Cloudflare, Supabase, etc.). Zero Supabase queries, zero KPIs. The "ManageEngine Endpoint Central" integration mentioned in `CLAUDE.md` as a future possibility is, today, confirmed to be nothing more than an outbound link to the vendor's own console — no sync, no API, no env vars or service stubs anywhere in the codebase. |

### This is an app-wide pattern gap, not a Sales/Finance-specific one

Direct inspection of `HRRoutes.jsx`/`ITRoutes.jsx` shows the identical shape mismatch independently recurring: HR's Employees and Attendance already use the Overview+List tab pattern; Departments, Leaves, Recruitment, and Performance are flat single pages. IT's Assets uses the tab pattern; Software and the "Dashboard" launcher are flat. The rule in §6 resolves all of these the same way it resolves Sales/Finance — this is worth fixing as one convention, applied everywhere, not four separate module-by-module decisions.

---

## 4. Data foundation audit — do we have all the required tables?

**Verdict: No — not for true company-wide financial or operational reporting.**

### What's actually extracted today

`hyrax-data-platform` pulls exactly **11 SAP Business One tables** into Supabase, confirmed exhaustively against `docs/DATA-DICTIONARY.md`, `CLAUDE.md`, and the live extractor's field-mapping config (`ingestion/sap_supabase/src/config.py`):

| SAP table | Supabase table             | Grain  | Holds                                                              |
| --------- | -------------------------- | ------ | ------------------------------------------------------------------ |
| ORDR      | `sap_sales_orders`         | Header | Sales order: customer, dates, totals, GP                           |
| RDR1      | `sap_sales_order_lines`    | Line   | SO line detail: item, qty, price, cost, warehouse                  |
| ODLN      | `sap_deliveries`           | Header | Delivery/goods-issue header                                        |
| DLN1      | `sap_delivery_lines`       | Line   | Delivery line detail + back-link to SO                             |
| OINV      | `sap_invoices`             | Header | AR invoice: totals, paid-to-date, tax, GP                          |
| INV1      | `sap_invoice_lines`        | Line   | Invoice line detail + back-link to delivery/SO                     |
| ORCT      | `sap_payments`             | Header | Incoming customer payment                                          |
| RCT2      | `sap_payment_applications` | Line   | Which invoice(s) each payment was applied to                       |
| OITM      | `sap_items`                | Master | Item master — company-wide aggregate stock, cost, UoM              |
| OCRD      | `sap_customers`            | Master | All business partners (customers **and** vendors, via `card_type`) |
| OSLP      | `sap_sales_persons`        | Master | Sales rep master + `commission_pct` (never used anywhere)          |

Total volume across all 11 tables: **~20,000 rows, well under 100MB**, synced hourly via cron. At this scale, **infrastructure cost is a complete non-issue** — the real cost of closing any gap below is engineering effort (a column-discovery pass + a new field-mapping dict + a migration + docs, per table), which is a bounded, moderate lift per table, not a re-architecture.

### What's missing, ranked by what it blocks

| Rank  | Gap                                                                                    | What it blocks                                                                                                                                                                                                                                       | Why this rank                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **No General Ledger / Chart of Accounts** (SAP tables OACT, JDT1/OJDT journal entries) | True P&L, balance sheet, trial balance, real company-wide margin. **Finance today is an AR subledger with a "Finance" label on it, not financial reporting** — every KPI on Finance > Reports is revenue/collections/AR, never a true profit figure. | Most limits Finance **today**. Unlike production data, there's no workaround — you cannot approximate a P&L from AR documents alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **2** | **No vendor Purchase Orders or Goods Receipts** (OPOR/POR1, OPDN/PDN1)                 | AP aging, vendor spend analysis, purchase-price variance — the entire "other side" of the cash picture Finance already has for AR.                                                                                                                   | Structurally identical extraction pattern to the SO→Delivery→Invoice chain already built — the same shape, mirrored to purchasing. A bounded, well-understood lift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **3** | **No Production / Bill of Materials / Work Orders** (OITT, OWOR)                       | Plant-floor visibility: yield, scrap/rework, line utilization, work-order cycle time, standard-vs-actual cost variance.                                                                                                                              | **Most consequential given Hyrax Oil is a lubricants manufacturer** — but ranked 3rd, not 1st, because SAP MRP data (BOM explosions, routings, backflushing) is a materially larger and more complex extraction surface than the flat document-chain tables already handled. `hyrax-data-platform/docs/hyrax-portal.md`'s own roadmap points to a future "Plant IoT sensors" pipeline for production metrics, **not SAP** — meaning even the platform's own plan doesn't currently intend to source this from SAP. Recommend a scoping/discovery spike first to confirm this data is even configured and populated in Hyrax's SAP instance before committing real engineering time. |
| **4** | **No per-warehouse inventory** (OITW) **or warehouse master** (OWHS)                   | Location-level stock visibility. `sap_items.stock_on_hand` is a single company-wide aggregate per SKU; `warehouse_code` sits on every line item but resolves to nothing — no name, no address, just a code.                                          | Small, bounded lift (same extraction pattern as OITM already handled), but a single aggregate stock number is a workable stopgap for most day-to-day decisions today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **5** | **No cost-center or budget concept anywhere** — app-side or SAP-side                   | Department-level financial accountability, budget-vs-actual reporting.                                                                                                                                                                               | Not really an extraction gap — Hyrax's SAP instance itself has never been configured for cost-center accounting. This is a business-process/SAP-configuration decision before it's an engineering one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Lower priority / defer:**

- **Price Lists** (OPLN) — minor; only affects discount-realization analysis.
- **Returns/Credit Memos** (ORIN/RIN1, ORPD) — moderate accuracy risk: every revenue/GP figure on Finance Reports today is **gross of returns**, quietly overstating actuals. Cheap to fix with a visible caveat label in the UI now; not worth funding extraction for at current scale.
- **Banking/reconciliation** (OCHO, bank statements) — low value at SME scale where a bank portal likely already covers this.

### Two calls that are the user's, not best practice's

1. **Whether GL and/or production-data extraction is worth funding now**, given competing budget/timeline. This document recommends GL first on merit (it's the single biggest blocker to real Finance reporting, and there's no workaround), but the _timing_ is a business decision.
2. **Whether Hyrax wants to introduce cost-center/budget structure into SAP itself.** No amount of pipeline engineering substitutes for an SAP configuration and accounting-process change.

---

## 5. Cross-department linkage audit — does this link departments to each other?

**Verdict: Partially — and the split is clean enough to state precisely.**

### What's already linked today, no schema changes needed

HR, IT, and Sales/CRM are **already well-linked**, sharing one consistent identity backbone with real database-level foreign-key constraints:

```
auth.users → profiles → employees (department_id, manager_id) → departments
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
it_assets.asset_user_id  sales_leads.lead_owner_id  attendance_activities.employee_id
it_assets.asset_department_id   sales_targets.lead_owner_id   leave_balances.employee_id
                                 sales_quotations.created_by
```

Concretely: `employees.department_id` → `departments`, plus a self-referencing `employees.manager_id` (a full org hierarchy). `it_assets.asset_user_id`/`asset_department_id`, `sales_leads.lead_owner_id`, `sales_targets.lead_owner_id`, `attendance_activities.employee_id`, `leave_balances.employee_id` all point back into this same table with enforced FKs.

**Practical consequence**: a dashboard blending HR + IT + Sales/CRM, sliced by employee or by department, is achievable **today** with existing joins — no new bridge tables needed.

### What's not linked — Finance/SAP data is an island

Every `sap_*` table carries only `customer_code`, `sales_rep_code`, and `item_code` as attribution keys — **no department dimension, no employee UUID, anywhere in the SAP mirror.**

This is confirmed at the query level, not just the schema level: Finance's dashboard RPC (`get_finance_dashboard_rpc.sql`) attributes salesperson revenue purely within SAP tables (`sap_sales_persons.sales_rep_code`), while the Sales/CRM dashboard RPC (`get_sales_dashboard_rpc.sql`) attributes rep performance purely within app tables (`employees.id`). **The two are not currently joined in any query in either codebase** — but this is a matter of the bridge being _unbuilt_, not impossible (see the correction below).

> **Correction (rep identity is bridgeable — this was previously overstated as "impossible").** The link is a **direct join: `employees.employee_id` (the company employee code, `text`) = `sap_sales_persons.employee_id` (EmpID)** — the two hold the same value, so no mapping table and no schema change are needed; it is simply not built yet. The join key is `employees.employee_id`, **not** `employees.id` (the `uuid` PK) — the earlier claim that "neither field matches" conflated those two columns. (One caveat: SAP's EmpID is `bigint` and `employees.employee_id` is `text`, so cast one side, and confirm every sales employee's company code is actually populated in SAP's EmpID field.) SAP orders/invoices carry `sales_rep_code` (SlpCode), not the employee code, so the full path is `employees.employee_id` → `sap_sales_persons.employee_id` (EmpID) → `sap_sales_persons.sales_rep_code` → the transactional tables. So rep-level attainment (SAP realized revenue per salesperson, compared to a target/budget) is a one-time data check plus a join, not a structural blocker. See the [Department Dashboard Blueprint §4.1](./DEPARTMENT-DASHBOARD-BLUEPRINT.md) for the full design.
>
> What remains genuinely blocked is **department-level** slicing of Finance/SAP data — `sap_*` tables carry no department or cost-center dimension at all, so even with the rep bridge, rolling SAP revenue up _by department_ still needs a rep→department mapping (via `employees.department_id`) plus, for cost/P&L, a cost-center concept that doesn't exist yet.

### The compounding problem

Even where one half of a link is real — e.g. `it_assets.asset_department_id` → `departments` is a clean, enforced FK — there is **nothing on the Finance side to roll that cost into**, because no `sap_*` table carries a department or cost-center dimension at all (§4, gap 5). So "IT spend by department, rolled into a Finance department budget view" is blocked by **two compounding gaps**, not one: no mapping _and_ no cost-center concept to map into.

### What would unlock more

1. **Building the rep-identity bridge** (`employees.employee_id` → `sap_sales_persons`, per the correction above) — a reconciliation task, not new data extraction. On its own it unlocks per-rep SAP-revenue attainment; combined with `employees.department_id` it then enables a department-level _sales_ attainment rollup (SAP system-of-record revenue, sliced by the same department dimension HR/IT already use).
2. **A genuinely new cost-center/budget master table**, paired with GL data (§4 gap 1) — needed before any true department-level P&L becomes possible.

Neither of these is in scope for the dashboard work described in §8 — they're data-platform engineering, listed as Group C in the punch-list (§10).

---

## 6. The unified page-structure convention

### Naming — lock this in exactly, everywhere

| Word                               | Means                                                       | Scope                                     | Never means                                                                        |
| ---------------------------------- | ----------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| **List**                           | Operational record table (CRUD/workflow)                    | One entity's rows                         | Aggregated/analytical content                                                      |
| **Overview**                       | Entity-scoped analytics                                     | One entity, aggregated                    | Cross-entity synthesis; a stub placeholder                                         |
| **Reports**                        | Module/departmental dashboard                               | Cross-entity, within one department       | A single entity's Overview relabeled; a third-party iframe with no app integration |
| **Dashboard**                      | Portal/launcher home surface (Quick Actions, announcements) | Whole app or whole module, non-analytical | An analytics page                                                                  |
| _(reserved)_ **Executive Summary** | Cross-department synthesis                                  | Whole company                             | Anything built before the departmental Reports pages are solid                     |

"Reports" is recommended as the Tier-3 label (not "Dashboard") specifically because it's already the established name in the two places that have real Tier-3 content today (Sales Reports, Finance Reports) — this costs nothing to keep. "Dashboard" is already established elsewhere as the portal/launcher pattern (global Home, IT Dashboard) — keeping that split rather than merging the words avoids renaming anything and removes the naming collision. This specific word choice is otherwise low-stakes — see §11.

### The rule for when a submodule earns its own Overview+List

A submodule gets the `PageLayout`+tab-bar pattern (Overview _and_ List as siblings) only when **both** are true:

1. It's a distinct, analyzable entity/process with real recurring KPIs or trends a manager would want to check on its own, independent of the module's Reports page.
2. Its List is a genuinely active, maintained operational record set — not a stub, not a pass-through to somewhere else.

If it fails test 1 (a short reference/config list with nothing to chart — e.g. HR's Departments), it should stay a **flat single page**. Don't invent an Overview tab purely for visual consistency — an empty or trivial Overview tab teaches users to stop trusting the label, the opposite of the "learnable mental model" goal.

If it fails test 2 because it's a **read-only system-of-record drill-through target** (Finance Invoices, and Payments once built), it should also stay **flat, List-only** — its aggregation already belongs, correctly, one tier up in Reports.

This is a **procedural** rule (same decision test everywhere), not a demand that every module look visually identical. Modules don't need matching page counts; they need the same rule applied to decide their shape.

### Directly answering the two structural questions

**"Should Finance be restructured to match Sales' tab convention — merge Reports as an Overview tab alongside Invoices as List?"**

**No.** Reports is Tier-3 (it already synthesizes invoices + collections + salesperson health); Invoices is Tier-1. Pairing them as Overview/List tabs would misrepresent Reports' cross-entity scope and make it awkward to add Payments/Claims as further siblings later without conflating them into "Invoices." Notice also: **Sales Reports is already a flat, top-level sibling of Clients and Leads today** — it is not nested inside either of their tab bars. So Finance Reports being flat and top-level is _already consistent_ with Sales, not the inconsistency it appears to be. The real comparison isn't Finance:Reports vs Sales:Reports (both are correctly flat) — it's Finance:Invoices vs Sales:Clients/Leads, and there the answer is simply that Invoices doesn't pass the Overview-eligibility test, exactly like HR's Departments or IT's Software.

**"Should Sales Reports (the Looker iframe) be replaced by promoting Leads Overview's dashboard pattern to the module level?"**

**Replace the iframe: yes, definitively. Promote/move Leads Overview wholesale: no.** Build a _new_ native Sales Reports reusing the same proven components (`OverviewCards`, `ChartCard` renderers, `ScorecardList`, `ExportActions`, `AISummary`) and the same RPC-driven pattern Leads Overview already validated — but change its _scope_ to genuine Tier-3 synthesis (see §8 for the concrete KPI list), framed for monthly/quarterly director review. **Leads Overview keeps every chart it has today, unchanged** — its content is squarely Tier 2 (daily rep-coaching cadence), and duplicating it verbatim one tier up would recreate the exact Reports-vs-Overview redundancy this document exists to eliminate.

---

## 7. Financial vs. sales dashboard — the salesperson-performance question

Two structurally disconnected definitions of "salesperson performance" exist today:

|                       | Sales/CRM scorecard (Leads Overview)                                                                                                    | Finance "Salesperson Health" (Financial Reports)                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Revenue source        | `sales_leads.actual_revenue` — a number a rep **manually types in** when marking a lead WON, never cross-checked against a real invoice | `sap_sales_orders.total_amount_myr` + gross profit — the SAP system-of-record figure   |
| Compared to a target? | Yes — `sales_targets.target_revenue`, prorated across the filtered period → attainment %                                                | No — no quota/target concept exists on the Finance side at all today                   |
| Rep identity key      | `lead_owner_id` → app `employees` table                                                                                                 | `sales_rep_code` → SAP's `sap_sales_persons`                                           |
| Nature of the number  | Forward-looking/self-reported — a forecasting & coaching signal                                                                         | Backward-looking/audited — the number that, in principle, should be compensation-grade |

**Why this split exists, and why it's actually normal:** in any organization running CRM and ERP side by side, CRM figures are inherently a _forecasting/coaching_ signal, while ERP-recognized revenue is the only figure that should ever be compensation- or audit-bearing — precisely because self-reported numbers are gameable. That's not hypothetical here: nothing today checks a rep's typed-in `actual_revenue` against what SAP actually invoiced.

**Why it can't simply be "fixed" by picking one:** the bridge infrastructure that _should_ connect the two — an app-native `sales_orders` link table meant to tie a CRM lead to its SAP sales order, plus `sales_quotations`/`sales_quotation_items`, plus `sales_attainment_snapshots` (designed for locked historical attainment records) — is confirmed **100% dead**: zero application code anywhere reads or writes any of them. And the two rep-identity keys (`employees.lead_owner_id` vs. `sap_sales_persons.sales_rep_code`) are never joined (§5).

### The recommendation: an explicit now-vs-later split

**Now** (zero data-model work, shippable this week): don't silently pick a winner, and don't merge the two numbers. Show both, clearly labeled:

- Relabel Leads Overview's scorecard: _"Pipeline Attainment — CRM, self-reported at deal-close, vs. quota"_ — framed explicitly as a forecasting/coaching tool.
- Relabel Finance's Salesperson Health: _"Recognized Revenue & Gross Profit by Rep — SAP system-of-record, no quota comparison yet."_
- Add a shared tooltip/disclosure on both stating plainly that they use different identity keys and different revenue definitions, and may legitimately disagree. This converts a currently-silent structural gap into a disclosed, understood limitation — the highest-leverage fix available at essentially zero engineering cost.

**Later** (real `hyrax-data-platform` engineering, its own project):

1. Build the `employees.lead_owner_id` ↔ `sap_sales_persons.sales_rep_code` mapping.
2. Wire the dead `sales_orders` bridge table so a WON lead's declared revenue/PO validates against the real SAP order/invoice instead of being trusted at face value.
3. Decide the canonical revenue definition for compensation (a business-policy call — see §11).
4. Rebuild the attainment calculation off that canonical figure, so there's **one** attainment number surfaced at both cadences.
5. Only then does populating `sales_attainment_snapshots` (period-end locking) and wiring `commission_pct` into a real commission calculation make sense.

### Terminology note: what "PO" means in this system

**"PO" always means the customer's purchase order** — the proof-of-deal document a client sends _to_ Hyrax — never a vendor/procurement PO. Hyrax doesn't track vendor POs at all today (§4, gap 2). It's captured only as a manually-typed `po_number`/`po_document_url` on a lead at the WON transition, with no automated linkage from that field to the real SAP sales order or invoice, and the platform's own internal docs even disagree on which SAP field should be the join target.

---

## 8. Full dashboard/KPI/chart catalog

Each item is tagged:

- **(A)** buildable today from existing data — table/RPC cited.
- **(B)** buildable today, needs new UI/query work — the data exists, it's just not surfaced yet.
- **(C)** blocked — needs new SAP extraction or new schema (named explicitly).

### Sales > Clients Overview _(Tier 2 — needs building; account-portfolio health, never rep performance — that's Leads' job)_

_Audience: Sales reps + Sales manager. Cadence: daily/weekly._

| KPI / chart                               | Tag  | Notes                                                                                                                                                                        |
| ----------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total Active Clients                      | B    | Clients with ≥1 non-cancelled lead in a trailing window                                                                                                                      |
| New Clients This Period                   | A    | Straight `clients.created_at` filter                                                                                                                                         |
| Active Pipeline Value by Client           | A    | Sum `sales_leads.expected_revenue` for open stages, grouped by client                                                                                                        |
| Realized SAP Revenue by Client            | B ⚠️ | Bridges via `clients.sap_bp_id` — a manually-typed, unvalidated text field with no FK or reconciliation job. Audit the match rate before shipping this as a headline number. |
| Client Portfolio by Industry              | A    | `clients.industry_id`                                                                                                                                                        |
| Pipeline-to-Realized Conversion by Client | B ⚠️ | Same `sap_bp_id` caveat as above                                                                                                                                             |
| Account Recency                           | A    | Days since last `sales_leads_stage_history.changed_at`                                                                                                                       |
| At-Risk Accounts                          | A    | No active lead in N days, or only LOST leads recently                                                                                                                        |

### Sales > Reports _(Tier 3 — needs building; explicitly distinct from Leads Overview — director/monthly cadence, not daily rep coaching)_

| KPI / chart                                                         | Tag | Notes                                                                                                                                |
| ------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Department-Level Quota Attainment                                   | A   | Aggregate of the existing per-rep attainment logic                                                                                   |
| Quote-to-Win Conversion & Median Days-to-Win                        | A   | Build off fields already on `sales_leads` (`quotation_url`, stage history) — **not** the confirmed-dormant `sales_quotations` tables |
| Realized (SAP) vs. Pipeline-Implied (CRM) Revenue, department level | B   | Present as two systems of record side by side — the department-level cut of §7's disclosed duality, don't blend into one number      |
| Win Rate & Avg Deal Size Trend                                      | A   | Already in `get_sales_leads_dashboard`                                                                                               |
| Sales Cycle Health (avg days to close/lost)                         | A   | Already computed in the sales RPC                                                                                                    |
| Product-Type Mix of Won Revenue                                     | A   | Already in the sales RPC                                                                                                             |
| Lead Source ROI                                                     | A   | Already in the sales RPC                                                                                                             |
| Account Portfolio Health Rollup                                     | A/B | Mirrors Clients Overview, rolled up                                                                                                  |

### Finance > Reports _(already built — additions worth calling out)_

Already live: Tier-1 KPIs (Revenue Invoiced, Cash Collected, Outstanding AR/DSO, Overdue Risk), Tier-2 (AR Aging, Top Overdue Customers, Collection Rate, Revenue Trend), Tier-3 (Salesperson Health, Top Customers by Revenue).

| Addition                                                       | Tag                                                                                         | Notes                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unallocated-payments drill-down list                           | B                                                                                           | The KPI tile exists (`unallocatedPayments`); there's no supporting list of which customers are sitting on unapplied cash — cheap collections win |
| Net-revenue-gross-of-returns caveat label                      | C                                                                                           | Blocked on Returns/Credit-Memo extraction (§4). Caveat the existing Revenue Trend/Salesperson Health charts now rather than wait                 |
| AP Aging chart (mirrors the existing AR Aging pattern exactly) | C                                                                                           | Blocked on gap #2 (§4) — the obvious next chart the moment purchasing data lands, since the UI pattern already exists                            |
| Company-wide Gross Margin % trend                              | B for a rollup of existing sanitized GP data; **C** for a true COGS-based margin (needs GL) |

### HR > Employees Overview

**Fix first, before adding anything:**

- "Inactive Employees" card is bound to `kpis.terminatedEmployees` — rename the card to "Terminated Employees" (matches what it shows), and add a genuinely separate "Inactive/Suspended" card from the hook's already-correct `inactiveEmployees` set.
- "Average Team Size" card is bound to the wrong field — swap to `kpis.avgTeamSize`, already computed correctly in the hook.

**Then add, in priority order (all B — computed in the hook already, just not wired to a card/chart):**

1. `terminationRate` (already computed)
2. `avgTeamSize` (freed up by the fix above)
3. Termination-reason breakdown (already grouped)
4. **Tenure** — average tenure + a bucketed chart (<1yr, 1–3, 3–5, 5–10, 10+). The one true "pure missed opportunity": `join_date` is already fully populated, this needs only a small date-diff calculation, no new data.
5. Nationality breakdown (already grouped, lower priority)

**Do not** migrate this page to the RPC-driven pattern right now — headcount is small enough that client-side aggregation is genuinely fine. Reserve the RPC pattern for HR Reports, where real cross-table joins and period deltas are actually needed. "Match the other dashboards' pattern" alone isn't sufficient justification for a rewrite that fixes nothing broken.

### HR > Attendance Overview — the flagship opportunity

_Currently a literal empty stub sitting on top of a rich, already-built data pipeline: a biometric scanner (polls every 60s) plus app self-service clock-ins feed a production Supabase view (`unified_daily_attendance`) that already computes, per employee per day: first-in/last-out, hardware-vs-app reconciliation, pre-computed `hours_worked`, and an `hr_flag` anomaly field._

| KPI / chart                                       | Tag | Notes                                                                               |
| ------------------------------------------------- | --- | ----------------------------------------------------------------------------------- |
| Attendance Rate %                                 | B   | Days with a recorded `first_in` ÷ expected employee-days                            |
| Avg Hours Worked/Day                              | B   | Mean of `hours_worked`                                                              |
| "Review Required" (`hr_flag`) count               | B   | The single most actionable number on this page                                      |
| Hardware/App Reconciliation Rate %                | B   | Genuinely novel — unique to this dual-source pipeline, not replicable anywhere else |
| `hr_flag` distribution (donut)                    | B   |                                                                                     |
| Hours-worked trend (line, daily/weekly)           | B   |                                                                                     |
| By-department attendance rate (bar)               | B   | `department_name` already denormalized onto the view                                |
| Top managers/departments by Review-Required count | B   | Actionable drill list                                                               |

**Explicitly do not build:** a "Late Arrivals" / "Punctuality Rate" KPI **(C, blocked)** — no shift-schedule/expected-start-time table exists anywhere, and this is explicitly gated in the data platform's own docs on a future HR2000 integration. A confidently wrong lateness number is worse than an absent one — ship the honest proxies above and gate any lateness KPI on that integration landing.

### HR > Reports _(nav link exists, route is missing entirely — build via the Finance-RPC pattern, not the Sales-iframe pattern)_

Should synthesize, period-over-period, across Employees + Attendance + (once activated) Leave:

- Headcount movement: hires vs. exits vs. net change this period vs. last.
- Attendance rate + Review-Required rate by department, vs. prior period.
- Leave utilization (used/remaining vs. allocated, pending-approval aging) — once Leave is activated.
- Termination reasons + termination-rate, trended over time rather than a single snapshot pie.

### Leave — sequencing recommendation

Fully designed schema (`leave_types`/`leave_balances`/`leave_requests`/`leave_holidays`), **zero rows ever written or read** — "designed but dormant," not "doesn't exist."

**Recommended order: Attendance Overview → HR Reports v1 (Leave section omitted/"coming soon") → activate Leave → extend HR Reports with real Leave data.** Shipping a Leave dashboard against zero rows looks broken, not "not yet built" — worse than deferring it. Note: `CLAUDE.md` flags that legacy HR data may migrate in via the Data Platform project and reshape this module — confirm Leave-activation timing against that roadmap before committing engineering time (a business-priority call, not a technical one).

### IT > Assets Overview

| Addition                               | Tag   | Notes                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MDM Enrolled vs. Not Enrolled donut    | A/B   | `mdm_status` field already exists on `it_assets`, currently unused in Overview — genuinely free                                                                                                                                                                                                                                       |
| Warranty-expiring-soon KPI             | **C** | Blocked by a **data-quality bug**, not missing SAP data: `warranty_expiry` is stored as `text`, not `date`. Fix the column type + backfill first.                                                                                                                                                                                     |
| Cost/Spend KPI                         | **C** | Same category of blocker: `purchase_cost` is stored as `text`, not `numeric`. **Do not** inline-cast as a shortcut — inconsistent existing text (currency symbols, commas, blanks) will throw or silently miscompute, and cost is exactly the number that erodes trust if wrong once. Migrate the column, backfill, then add the KPI. |
| True depreciation / current book value | **C** | No depreciation policy (method, useful-life assumption) exists anywhere — a Finance/IT policy decision to make before this is even a data-modeling question.                                                                                                                                                                          |

### IT > Software Management

**No schema exists at all** — same category as Recruitment/Performance/Claims. Do not invent a KPI list against nothing; build the license/software data model and capture UI first, and let the schema settle from real usage. Sketch only, so it isn't dropped from the roadmap: once a real model exists (vendor, seat count, cost/seat, renewal date, assigned-to), a future Overview would mirror Assets Overview's shape — Total Licenses, Seats Used/Available, Expiring-Soon count, Cost per Seat/Total Spend. Before building this, check whether license visibility already exists elsewhere (ManageEngine, vendor portals) that would make a bespoke schema redundant.

### "IT Dashboard"

**Rename it** — away from "Dashboard," since it's a quick-links launcher with zero analytics (e.g. "IT Quick Links" / "IT Tools"). A single-string, low-risk change, consistent with this document's naming convention.

**Do not build a Tier-3 "IT Reports" page yet** — IT currently has exactly one real Tier-2 source (Assets) and one page with no data model at all (Software). A Reports page today would just re-skin Assets Overview with nothing else to synthesize against. Revisit once Software Management has a real model + its own Overview.

### Executive Summary _(Tier 4 — entirely new; the first real instance of `CLAUDE.md`'s stated long-term vision)_

Built the same way as the other dashboards: one new RPC + the same shared components. No dbt/materialized-mart layer is needed at this data volume.

**Achievable today**, via the joinable HR/IT/Sales backbone (§5) plus the existing Finance RPC:

| KPI / chart                                                  | Tag                                 |
| ------------------------------------------------------------ | ----------------------------------- |
| Company Revenue & AR Trend                                   | A                                   |
| Cash Collected vs. Outstanding AR / DSO                      | A                                   |
| Sales Pipeline Health (active + weighted pipeline, win rate) | A                                   |
| Headcount by Department                                      | A (trivial, not yet built anywhere) |
| Headcount Trend (hires/exits)                                | B                                   |
| IT Asset Count & Allocation by department                    | A                                   |
| Leave utilization signal                                     | B (once Leave is activated)         |

**Blocked — needs new schema/extraction (§4):**

| KPI / chart                                 | Tag | Blocked on                                                  |
| ------------------------------------------- | --- | ----------------------------------------------------------- |
| True department-level P&L / cost allocation | C   | Doubly blocked — no department dimension in SAP _and_ no GL |
| Company-wide true P&L / EBITDA              | C   | No GL data (§4 gap 1)                                       |
| Production/manufacturing health tile        | C   | No OITT/OWOR (§4 gap 3)                                     |
| Vendor/procurement spend tile               | C   | No OPOR/POR1 (§4 gap 2)                                     |

**Unlockable via the sales-rep↔employee mapping (§5) — a reconciliation task, not new extraction:**

Department-Level Sales Attainment Rollup (SAP system-of-record revenue, not CRM self-reported). Until that mapping exists, Executive can only show CRM pipeline health and SAP realized revenue as two separate facts — the same two-disconnected-numbers problem from §7, now surfacing at the top tier.

---

## 9. Do's and don'ts for scope discipline

1. **Do** fix Employees Overview's two mislabeled KPI cards before shipping anything else in HR — a live, wrong number erodes trust in every other dashboard once someone notices, and it's a two-line fix.
2. **Do** build Attendance Overview next, ahead of everything else proposed here — the highest value-to-effort ratio in this entire document. The data already exists; it's sitting behind a literal empty `<div>`.
3. **Don't** leave `hr/reports`'s nav link pointing at a route that doesn't exist — a dead link in production is worse than no link. Build the page, or remove the nav entry, don't leave it broken.
4. **Don't** build a dbt/materialized-mart layer before any of the above — confirmed <100MB total data across all SAP tables, and the existing dashboards already compute live via Postgres RPC with no evidence of a performance problem. A transformation layer adds real operational cost for a scale problem Hyrax doesn't have yet.
5. **Don't** migrate Employees Overview off client-side aggregation "for consistency" with Finance/Sales — headcount scale makes the current approach genuinely fine. Reserve the RPC pattern for pages with real cross-table joins and period-over-period deltas (HR Reports, Sales Reports, Executive Summary).
6. **Don't** invent KPI/chart lists for Recruitment, Performance, Claims, or Software Management — none has a backing data model. A dashboard with nothing real behind it is worse than no dashboard; build the capture workflow first and let the schema settle from real usage.
7. **Don't** ship a cost or warranty KPI on IT Assets via an inline text-cast shortcut on `purchase_cost`/`warranty_expiry` — fix the underlying column types and backfill first. This is a data-quality bug, not a dashboard-design decision.
8. **Don't** build a Tier-3 "IT Reports" page yet — wait until Software Management has real data to synthesize against Assets.
9. **Do** reuse the Finance Reports RPC + shared-component pattern (`OverviewCards`/`ChartCard`/`ExportActions`/`AISummary`) for every new Tier-3 page — not the Sales-iframe outlier, and not a bespoke one-off each time. `AISummary` already writes to a generic, reusable `ai_dashboard_summaries` table — turning it on elsewhere costs nothing new.
10. **Don't** silently approximate the metrics that are genuinely blocked (lateness-vs-schedule, depreciation/book value, true P&L, department cost allocation) by guessing a threshold or proxy just to fill a chart. Name them explicitly as out of scope until their real inputs exist. A confidently wrong number is worse than an absent one.

---

## 10. Prioritized punch-list

### Group A — IA/navigation fixes _(cheap, days not weeks)_

- Fix the FIN/SAL access-control mismatch on Finance Invoices (§3).
- Add the dual-labeling disclosure copy on Leads Overview + Finance Salesperson Health (§7).
- Fix HR Employees Overview's two mislabeled KPI cards (§8).
- Fix or remove the broken `hr/reports` nav link (§3, §8).
- Rename "IT Dashboard" away from the word "Dashboard" (§8).
- Resolve the Quotations orphan-route contradiction — either hide it fully until built, or fast-track the build.
- Write the naming + tab-eligibility rules (§6) down as a short internal convention note so future submodules get built consistently without re-litigating this document.

### Group B — New feature builds _(real scope, needs its own sequencing)_

- Build Attendance Overview (flagship — do this first).
- Build Clients Overview.
- Build native Sales Reports, retiring the Looker iframe.
- Build HR Reports.
- Fold Quotations into Leads as a List-only tab, finally using the dormant `sales_quotations` schema (or formally retire it).
- Remove or relocate the Contacts top-level stub tab.
- Build Finance Payments / Claims Management as needed.
- Re-enable Finance's commented-out AI Summary.
- Fix `it_assets.purchase_cost`/`warranty_expiry` column types, then add the cost/warranty KPIs.
- Activate Leave — after Attendance Overview and HR Reports v1, and after confirming timing against the HR2000 roadmap.
- Build Executive Summary — once the departmental Reports pages above are solid.

### Group C — Data-model/backend fixes _(`hyrax-data-platform`, its own engineering project)_

- GL/Chart of Accounts extraction (§4, gap 1 — highest priority).
- Vendor PO/AP extraction (§4, gap 2).
- Production/BOM/work-order scoping spike (§4, gap 3 — confirm data exists in SAP before committing engineering time).
- Per-warehouse inventory extraction (§4, gap 4).
- The `employees` ↔ `sap_sales_persons` reconciliation mapping (§5, §7).
- Wiring the dead `sales_orders` bridge table (§7).
- A cost-center/budget master table, paired with GL (§4, gap 5; §5).

---

## 11. Open questions — genuinely the user's call

1. **Which revenue definition becomes canonical for compensation/attainment** — CRM self-reported vs. SAP-recognized, and if SAP, at order-booked vs. invoiced vs. collected stage. A finance/business-policy decision, not a technical one (§7).
2. **Whether Contacts warrants a standalone cross-client directory** at all, vs. staying embedded-per-client only — depends on actual internal demand this document has no visibility into.
3. **Whether Finance's Claims Management and HR's employee-facing Claims are the same underlying workflow** viewed from two role perspectives, or genuinely separate systems — changes whether Claims Management needs its own Overview.
4. **"Reports" vs. "Dashboard" as the Tier-3 word** — low-stakes; "Reports" is recommended only because it's already established in both places that need it. Fine to override, as long as it's applied uniformly afterward.
5. **Whether/when to fund closing the SAP data gaps** (§4) — GL and vendor-PO extraction are recommended first on merit, but timing and budget are the user's call.
6. **Whether Recruitment/Performance/Claims/Software data models are worth building at all right now**, vs. deferring indefinitely — a business-priority call, not a best-practice one.
7. **Whether existing license-visibility tools** (ManageEngine, vendor portals) already cover what a bespoke Software Management schema would provide, before investing in building one.

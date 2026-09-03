# Route Access-Control Matrix

`route_access_matrix.csv` is the single source of truth for who should have access to what in this app. It exists because access is currently enforced/expressed in three independently hand-maintained places that have already drifted out of sync:

1. **Sidenav config** — `src/data/sideNavLinkData.js`
2. **Home dashboard cards** — `src/data/departmentLinkCardData.js`
3. **Route guards** — `<AccessRoute departments={...} roles={...}>` in each `src/routes/*Routes.jsx` file — this is the only one that's actually *security-enforcing*; the other two are just nav/dashboard visibility and can be wrong without granting or denying real access.

All three are consumed by the same check: `canAccess({roles, departments})` in `src/context/AccessControlContext.jsx`. An empty/omitted `roles` or `departments` array means "no restriction" (open to any authenticated user for that dimension). `superadmin` bypasses every check.

## Departments & roles

Source of truth: `supabase/csv/departments_rows.csv` and `supabase/csv/roles_rows.csv` (literal exports of the live `departments`/`roles` tables — keep those files updated if the DB changes, this doc doesn't duplicate them).

**Roles**: `staff`, `manager`, `superadmin`.

**Departments** (`sub` code — name): `GEN`-General, `BDV`-Business Development, `SAL`-Sales, `MKT`-Marketing, `STR`-Corporate Strategy, `GEC`-GEC's Office, `HR`-Human Resources, `IT`-Information Technology, `OPS`-Operations, `PRD`-Production, `LOG`-Warehouse & Logistics, `PUR`-Purchasing, `QA`-Quality Assurance, `MGM`-Top Management, `FIN`-Accounts & Finance, `COM`-Corporate Communications, `SUS`-Suspended, `ADM`-Administration.

Only 6 of these 18 (`SAL`, `FIN`, `OPS`, `HR`, `IT`, `MGM`) gate anything today. `SUS`/`GEN` are non-operational fallbacks (suspended / unassigned profiles) and should never appear in any allow-list.

## CSV schema

One row per route/nav-entry currently present in the codebase (including inactive ones — see "Status values" below). Multi-value cells use `;` internally (e.g. `FIN;MGM`) since `,` is the CSV delimiter. Blank in any `roles`/`departments` cell means unrestricted; `n/a` means the concept doesn't apply to that row (e.g. a public route, or a redirect with no gate of its own).

| Column | Meaning |
|---|---|
| `module` | Sales / Finance / Operations / HR / IT / General / Workspace / Employee Self-Service / System / Help / Public |
| `route_path` | full app path, e.g. `/app/sales/reports` |
| `page_component` | file path of the rendered page, for traceability |
| `status` | see below |
| `sidenav_active` / `sidenav_roles` / `sidenav_departments` | current state of `sideNavLinkData.js` |
| `dashboard_card_active` / `dashboard_roles` / `dashboard_departments` | current state of `departmentLinkCardData.js` |
| `route_guard_roles` / `route_guard_departments` | current state of the `<AccessRoute>` in `*Routes.jsx` — today's real enforcement |
| `current_drift` | flags where the three current sources disagree with each other |
| `should_roles` / `should_departments` | **the target policy** — see design rules below. This is what the three sources should be reconciled to, not a copy of what's implemented today |
| `change_from_current` | whenever `should_*` differs from `route_guard_*` (today's real enforcement) — every proposed behavior change is visible here, nothing is silently changed |
| `rationale` | one-line justification for the `should_*` call |

### Status values

`built`, `stub` (page exists but has no real content/data yet), `dead-link` (an active nav entry points at a route that doesn't exist), `orphan-route` (the route is live and reachable but its nav/dashboard entry is commented out or missing), `layout-only` (an index route that just redirects to a child, with no gate of its own), `unbuilt-config` (a commented-out nav entry that references a path with no route at all — dead config, not just a hidden link).

## Design rules for `should_roles` / `should_departments`

Derived from each route's actual business purpose and the Tier framework this codebase already declares (`docs/DASHBOARD-CONVENTIONS.md`: List/Overview = operational/department-wide, Reports = department manager + exec) — **not** from copying today's implementation.

- **R1 — Public/pre-auth** (`/login`, `/`): not part of RBAC.
- **R2 — Universal/self-service**: no single department owns the data (Dashboard home, Profile, Department, Employees directory, Announcements, Notifications, Help, Workspace, Employee self-service forms) → unrestricted.
- **R3 — Department-owned List/Overview (Tier 1-2)**: owning department, **no role restriction** — staff and manager both do this work day-to-day.
- **R4 — Manager-function pages** (setting quotas/budgets, or a committed-revenue view paired with those): owning department + `manager`.
- **R5 — Department "Reports" (Tier 3)**: owning department + `MGM`, `manager` role — Top Management should see every department's Reports page, matching `CLAUDE.md`'s stated goal of "real-time dashboards for every department and for executives," not just the departments that happen to include it today.
- **Superadmin pages**: `superadmin` role, no department restriction.

### Judgment calls this matrix makes explicit (implemented 2026-07)

1. **Finance/Sales mismatch** (`finance/reports` granted `SAL` managers, but `finance/invoices`/`bills`/`vendor-payments` didn't) — fixed by **removing `SAL` from `finance/reports`**, not adding it to the others: Sales Reports' own `invoiceBudgetScorecardData` already gives Sales managers the PO-vs-Invoice-vs-Collected-vs-Budget reconciliation they'd otherwise need Finance Reports for.
2. **Sales Clients/Leads/Orders** (`sales/clients`, `sales/leads`, `sales/orders*`) granted `MGM` at the route level even though neither the sidenav nor the dashboard card exposed that — fixed by dropping `MGM` from these routes (R3: Top Management gets the Reports rollup, not raw row-level CRM/order records). **Superseded 2026-09**: this restriction was deliberately reversed — some MGM staff personally work Leads/Clients/Orders day-to-day, not just the Reports rollup — so `MGM` (company-wide, not manager-gated, matching how `SAL` itself is ungated on these R3 routes) was re-added to route/sidenav/dashboard-card together, plus `sales/leads/targets`, `sales/orders/budgets` (both R4, `manager`-gated, so MGM parity there is automatically manager-only), and `sales/rep-mapping`/`sales/guides` (not tracked in this CSV, added directly in code). See the drill-through section below for the corresponding un-reversal there.
3. **Operations Reports** — the inverse bug: nav and dashboard both granted `MGM`, but the route didn't — fixed by adding `MGM` back to the route (R5).
4. **Finance's manager-gated pages** (Invoices, Bills, Journal Entries, Chart of Accounts) — fixed by dropping the `manager` restriction, and **`MGM` was dropped from all six of Finance's Tier-1 operational pages** (Invoices, Payments, Bills, Vendor Payments, Journal Entries, Chart of Accounts, Claims Management), not just the four that were manager-gated: the app's own docs call these "Tier-1-only," and Tier 1 is explicitly defined as individual-contributor/daily in `DASHBOARD-CONVENTIONS.md`'s own tier table, so manager-gating (or granting exec-level `MGM`) any of them contradicts the app's declared IA. All six now share one identical gate: `FIN`, no role restriction.
5. **`sales/quotations`** (orphan route, was `manager`-only) — fixed by dropping the role restriction (R3: a record list reps maintain day-to-day, same shape as Leads/Clients).

### The drill-through bug this matrix's own fixes could have caused — and how it's avoided

Dropping `MGM` from Sales Orders and Finance's four operational pages (item 2 and 4 above) isn't safe in isolation: `sales/reports` and `finance/reports` (both `MGM`-visible) contain **real embedded links** to those pages —

- `OverviewCards` (`src/components/crud/overviewCards/OverviewCards.jsx`) wraps a KPI tile in a `<Link>` whenever its config sets a `to` path.
- `ChartCard` (`src/components/chartCard/ChartCard.jsx`) does the same via its `viewAllTo` prop.

Sales Reports' "Sales Order Book" tile and "Order Book by Rep" chart both link to `../orders`. Finance Reports has **nine** such links across its "Revenue Invoiced"/"Cash Collected"/"Overdue Risk" tiles and its AR/AP Aging, Unallocated Payments, Top Overdue Vendors, Top Vendors by Spend, and Unallocated Outgoing Payments charts, resolving to `../invoices`, `../payments`, `../bills`, and `../vendor-payments`. Without a fix, an `MGM` viewer on either Reports page would click a KPI tile or chart and land on `UnauthorizedUser` — the same bug class this whole matrix was built to catch, just a second instance of it.

**Fix implemented**: rather than re-widening `MGM` into those operational pages (which would undermine why it was removed), each link is now computed from the *viewer's own* `canAccess()` result for its target route, falling back to `null`/`undefined` (rendering as a plain, non-clickable card/chart — a state both components already supported for other tiles) when the viewer can't open the target:

- `src/pages/user/sales/reports/Reports.jsx` computes `canAccessOrders = canAccess({departments:["SAL","MGM"]})` (matching `sales/orders`' actual gate, updated 2026-09 for the MGM reversal above) and passes it into `getSalesReportsOverviewConfig(...)`; the "Order Book by Rep" chart's `viewAllTo` uses the same flag. The same `canAccess({departments:["SAL","MGM"]})` check also gates the matched-order/matched-lead cross-link buttons in `SalesOrderSidebar.jsx`, `LeadSidebar.jsx`, and Finance's `InvoiceSidebar.jsx` — all four moved together so no viewer ends up with a route they can open but a drill-through link that still treats it as closed. Note `canSeeNeedsAttention` on the same Reports page stays `canAccess({departments:["SAL"]})` deliberately — that's an audience-calibration choice (MGM sees the exec rollup, not day-to-day coaching action items), not a route-access gate, and is intentionally not part of this reversal.
- `src/pages/user/finance/financialReports/FinancialReports.jsx` computes `canAccessFinanceOps = canAccess({departments:["FIN"]})` — one flag covers all nine links, since Invoices/Payments/Bills/Vendor Payments now share an identical gate — and passes it into `getFinanceOverviewConfig(...)` plus every `viewAllTo` prop.

**Convention for future pages**: any new drill-through link/button on a Reports page must be gated the same way — computed from `canAccess()` against its *target* route, never assumed to follow just because the viewer can see the page the link lives on. `OrdersPageLayout`'s tab bar (`All Orders`/`Budgets`) was checked too — it's currently safe because both tabs share an identical `SAL`+`manager` gate at every level, so no viewer can reach one tab but not the other today, but that stops being true the moment those two gates are ever allowed to diverge.

## Out of scope / next steps

- `src/pages/index/Home.jsx` is dead code (not referenced by any route) and isn't listed here.
- See `table_access_matrix.csv` below for the route→backing-table mapping this file used to call out as missing — that gap is now closed for Sales/Finance.

---

## Table Access Matrix (Sales & Finance)

`table_access_matrix.csv` is the route→table mapping needed to turn `route_access_matrix.csv`'s page-level targets into actual Postgres RLS policies. Scoped to the Sales and Finance modules (including each module's own Reports page) — Operations is a separate module and not covered here. Built from a full audit of every `supabase.from(...)`/`supabase.rpc(...)` call in `src/features/sales/**`, `src/features/finance/**`, `src/pages/user/sales/**`, `src/pages/user/finance/**`, plus a line-by-line read of all four dashboard RPC SQL files in `supabase/sql_editor/`.

### Why this is a separate CSV from the route matrix

**RLS applies per table, not per route, and a table's real required scope is the union across every page/RPC that legitimately reads it** — often broader than any single page's own frontend gate. Concretely: `sap_invoices` is read by Finance Invoices (`FIN`, any role), Finance Reports (`FIN;MGM`, manager), and Sales Reports (`SAL;MGM`, manager — the order-vs-invoice reconciliation chain). Its real policy set is 3 separate permissive SELECT policies (Postgres ORs permissive policies together automatically): `FIN`/any-role, `SAL`/manager, `MGM`/manager. One CSV row per (table, department, role) combination, not one row per table — a narrower row (e.g. a manager-only slice) is annotated "already covered" when a broader row for the same department already subsumes it, so the actual number of policies to write is smaller than the row count suggests.

### Column meanings

`table_role`: core-data / lookup-dimension / display-join (⚠ flagged where it's an **inner join** — an RLS denial there doesn't null a display field, it silently **drops the whole row** from that chart/KPI, e.g. `sap_sales_persons` in Sales Reports' "Order Book by Rep") / line-item-detail / metadata-freshness.

`access_scope`: `self` or `all`. Checked whether any Sales/Finance table has ownership-scoped access today the way `attendance_activities` already does via `manager_id` — **none do**. `sales_leads.lead_owner_id` exists and could support a "staff edit only their own leads" pattern, but the current frontend has no such filter anywhere, so introducing it now would be a new behavior restriction, not an alignment — every row is `all`, with `sales_leads` flagged in its own notes as a future self-scope candidate.

`existing_policy_status`: `none-found` (no policy file anywhere in this repo for that table — true for every `sap_*` table), `create-not-confirmed-applied` (`sales_targets`/`sales_budgets` — `supabase/policies/sales_targets_budgets_crud.sql` drafts this but its own header comment says RLS may not even be enabled yet), `n/a-cannot-have-rls` (the materialized view — see below).

### The materialized-view finding, and the fix already applied

`get_finance_dashboard` reads `private.mv_gl_monthly_account_summary` for its GL/P&L figures. **Postgres does not support `ENABLE ROW LEVEL SECURITY`/`CREATE POLICY` on materialized views at all** — RLS only exists for regular tables. A materialized view is a physically-stored snapshot from whenever it was last refreshed (here, by the ingestion pipeline's own privileged connection); reading it later doesn't re-check the source tables' RLS, because the data is already baked in. Its access is controlled only by a blunt, non-row-aware `GRANT SELECT` — which has to be given broadly enough for any legitimate FIN/MGM caller's session to succeed, meaning **any authenticated user who called `get_finance_dashboard` directly (bypassing the frontend entirely) would get back real company-wide Net Profit/EBITDA/Balance Sheet figures, regardless of department**, since no RLS policy on any regular table could ever protect that slice of the output.

**Fixed**: added an authorization guard directly inside `get_finance_dashboard_rpc.sql` (right after the `declare`/`begin` block, before the function's existing "1. Calculate the Previous Period" step) that checks the caller's role/department via `profiles`/`roles`/`departments` and `raise exception`s unless they're `superadmin` or a `manager` in `FIN`/`MGM` — mirroring the frontend's `finance/reports` gate exactly. This is scoped to `get_finance_dashboard` only: the other three dashboard RPCs read only regular tables, which get properly protected once this CSV's policies are in place, so a direct-call bypass attempt against those comes back empty/filtered rather than fully unrestricted. **Requires a manual redeploy** — like every RPC in this repo, editing the `.sql` file doesn't change production until someone re-runs it in Supabase Studio's SQL editor.

### Out of scope for this CSV

- The actual `CREATE POLICY`/`ALTER POLICY` SQL isn't generated yet — there's no DB connection available in this environment to inspect what's already live beyond the 2 tables covered by `supabase/policies/*.sql`, and the user has already created some policies directly in Studio. This CSV is the reviewable precursor; a follow-up pass will either use a live `pg_policies` dump the user provides, or generate idempotent `DROP POLICY IF EXISTS` + `CREATE POLICY` pairs under a canonical naming convention.
- Operations-exclusive tables (`sap_deliveries`, `sap_delivery_lines`, and Operations' broader stock-position use of `sap_items`) aren't covered — a separate pass if needed.

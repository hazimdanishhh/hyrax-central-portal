# Sales Reports Restructure — Order-to-Cash Funnel + Audience-Specific Views

**Purpose of this document**: the design and phased execution plan for restructuring Sales Reports around the Order-to-Cash (O2C) process — Pipeline → Sales Order → Invoice → Payment — so the page serves all three real audiences (individual salesperson, department meeting, manager 1:1) instead of one department-only view arranged by source system. Phase 0 and Phase 1 are built (2026-08); Phase 2 is designed in full below but intentionally not yet built — this doc is what a future session picks up to build it, instead of re-deriving the design from scratch.

**Relationship to existing docs**: this document is the execution plan and rationale; it doesn't replace the underlying references. For the current field-by-field RPC contract, see `docs/RPC-REFERENCE.md`'s `get_sales_reports_dashboard` section. For the app-wide dashboard IA conventions (tiering, source-labeling, KPI color rules) this plan follows, see `docs/DASHBOARD-CONVENTIONS.md`. For the module-level backlog/status this plan's items roll up into, see `docs/DASHBOARD-ROADMAP.md` §2.1. For the CRM lead lifecycle and the SAP identity bridge this plan relies on, see `docs/SALES-ORDER-PIPELINE-ROADMAP.md` and `DASHBOARD-ROADMAP.md` §1.1.

---

## Part 1 — Why this restructure, and the research behind it

Sales Reports previously arranged its content by *source system* — an "SAP block" of tiles/charts, then a "CRM block" tacked on at the end — rather than by the business process it actually reports on. That process is a textbook Order-to-Cash (O2C) funnel: Pipeline (CRM, self-reported) → Sales Order (SAP, booked) → Invoice (SAP, billed) → Payment (SAP, collected), compared against two separate, deliberately-never-blended forecasts (a CRM pipeline quota and a SAP-side invoice budget).

Research (2026-08, sources below) converged on a few concrete, applicable principles used to drive every design decision in this plan:

- **Role-based tiering is the standard answer to a 3-audience problem.** An individual rep's dashboard should be daily/action-oriented (quota, unbilled backlog, real-time commission visibility), not a shrunk department report. A manager's view should foreground *deviations* (management-by-exception) — who's behind, whose backlog isn't converting — not flat totals across every rep. A department/exec rollup wants a holistic, five-second read.
- **Funnel/pipeline visualization**: show stage-to-stage value and flag where the funnel is leaking, rather than reporting each stage's total in isolation.
- **Inverted-pyramid layering**: headline status at the top, trends/comparisons in the middle, row-level detail/drill-through at the bottom — the vertical order should mirror business-priority order. This app already applies this at the page level (KPI row first, detail below); this plan reorders what's *below* the KPI row to follow the funnel instead of the source system.
- **RevOps discipline**: shared stage definitions and shared KPIs prevent "whose numbers are right" arguments. This app's existing Source-labeling convention (`DASHBOARD-CONVENTIONS.md`) already achieves this; this plan extends it and never blends sources silently.

Sources: [Role-based sales dashboards (Teamgate)](https://www.teamgate.com/blog/how-to-build-role-based-sales-dashboards/), [Sales dashboard guide (Improvado)](https://improvado.io/blog/sales-dashboard), [Order to Cash KPIs (QX Global)](https://qxglobalgroup.com/fa/uk/blog/essential-o2c-kpis-for-business-efficiency/), [Order to Cash process (Sage)](https://www.sage.com/en-us/blog/order-to-cash-process-otc-o2c/), [Sales pipeline dashboard best practices (Teamgate)](https://www.teamgate.com/blog/best-practices-visualizing-sales-pipeline-trends/), [How to visualize sales funnel stages (Worksbuddy)](https://worksbuddy.ai/blogs/how-to-visualize-sales-funnel-stages-and-fix-conversion-bottlenecks/), [Management by exception (AccountingTools)](https://www.accountingtools.com/articles/what-is-management-by-exception.html), [Dashboard design and the inverted pyramid (DataCamp / Excelsior)](https://www.datacamp.com/tutorial/dashboard-design-tutorial), [RevOps framework (Default)](https://www.default.com/post/revops-framework), [Sales compensation dashboards (CaptivateIQ)](https://www.captivateiq.com/blog/sales-compensation-dashboards-and-analytics), [Information Dashboard Design, Stephen Few — book review (The Data School)](https://www.thedataschool.co.uk/a/elnisa-marques/information-dashboard-design-effective-visual-communication-data-stephen-book-review/)

**Codebase constraints this plan respects throughout**: no dedicated funnel/waterfall chart component exists in this app — the established convention (already used for this page's own Pipeline Stage chart and Finance's Cash Flow Waterfall) is substituting `HorizontalBarChartRenderer`/`HorizontalMultiBarRenderer` for funnel-shaped data; this plan introduces no new chart primitive. RPCs are hand-pasted SQL into Supabase Studio (no migration CLI) — every RPC change is additive, never a rewrite of working logic. The app is maintained by a solo IT/dev function — work is phased so each phase is independently shippable.

---

## Part 2 — Status

| Phase | What | Status |
|---|---|---|
| 0 | Fix a fail-open scoping bug in `get_sales_reports_dashboard`'s owner→rep resolution | **Built 2026-08** |
| 1 | Restructure `sales/reports` around the O2C funnel (department + manager audience) | **Built 2026-08** |
| 2 | "My Sales" individual salesperson self-service page | **Designed, not built** — see Part 5 |

---

## Part 3 — Phase 0: the fail-open scoping bug (built)

**The bug.** `get_sales_reports_dashboard_rpc.sql`'s owner→rep resolution —
```sql
if v_owner_id is not null then
    select m.sales_rep_code into v_sales_rep_code
    from employee_sales_rep_mapping m
    where m.employee_id = v_owner_id;
end if;
```
— left `v_sales_rep_code` as `NULL` whenever the selected employee had no `employee_sales_rep_mapping` row with `employee_id` set (a real, still-manual-only state — see `DASHBOARD-ROADMAP.md` §1.1). Every downstream predicate reads `(v_sales_rep_code is null or x = v_sales_rep_code)` — so `NULL` meant "no filter," not "scope to nothing." A manager selecting an unmapped salesperson in the Salesperson filter saw **every company invoice/order/payment/budget, unfiltered**, while the CRM side stayed correctly scoped — silently, with no visual difference from a real filtered view. Fail-open, not fail-closed.

**The fix.** A sentinel immediately after the resolution block, requiring no change to any existing CTE predicate (they already read `v_sales_rep_code is null or x = v_sales_rep_code`):
```sql
if v_owner_id is not null and v_sales_rep_code is null then
    v_sales_rep_code := -1;  -- sentinel: no real sales_rep_code is negative, guarantees zero SAP rows
end if;
```
Plus a top-level `'ownerSapMappingMissing'` JSON field (`v_owner_id is not null and v_sales_rep_code = -1`) so the frontend shows a clear explanatory note instead of a page that just looks empty.

File: `supabase/sql_editor/get_sales_reports_dashboard_rpc.sql`.

---

## Part 4 — Phase 1: restructure `sales/reports` around the O2C funnel (built)

**New section order**, replacing the prior 4-tier "SAP block then CRM block" layout:

1. **Headline KPIs** (`OverviewCards`, same 8 tiles — reordered only). Row 1: one tile per O2C stage — Pipeline Attainment → Sales Order Book → Invoice Budget Attainment → Payments Collected. Row 2: their diagnostics — Pipeline Health, Win Rate, Sales Cycle, Customer Concentration.
2. **The O2C Funnel** (new): one `ChartCard` → `HorizontalBarChartRenderer`, four bars (Pipeline Won → Sales Order Booked → Invoice Billed → Payment Collected), sourced entirely from existing `kpis` fields. The existing "Invoice (SAP) vs Pipeline (CRM) Revenue" trend chart moves here as the funnel's time-series companion, in its own `marginTop`-spaced `ChartCard`, matching this page's existing chart-to-chart spacing convention exactly. A custom count/ratio "stat strip" (raw `CardLayout`+`generalCard` mini-cards) was tried and reverted the same day — it didn't reuse `OverviewCards`' internal structure that `.generalCard`'s CSS expects, causing sizing/overlap issues, and duplicated info (`orderBookCount`, `collectionRatePct`) already shown on existing KPI tiles. Kept simple: the funnel chart is the whole section, using only the established `ChartCard` wrapper — no new container pattern.
3. **Needs Attention** (new, `SAL`-only — not `MGM`): `ScorecardList` reused a second time, fed a client-side-filtered slice of `invoiceBudgetScorecardData` (attainment below the existing 80% warning threshold, high unbilled backlog, or low collection rate) — zero new RPC data.
4. **Rep Funnel Scorecard** (renamed from "Invoice Budget Scorecard", extended): the RPC already computed `collected_myr`/`invoice_vs_collected_variance_myr`/`collection_rate_pct` in `invoiceBudgetScorecardData`, but neither `Reports.jsx`'s mapping nor `LeadsScoreCard.jsx` rendered them, despite the section's own subtitle already claiming a "Collected" leg existed. Now wired end-to-end, gated the same way `hasOrderVariance` already gates the PO/Invoice segment (so Leads Overview's simpler CRM-only reuse of the same component is unaffected).
5. **Pipeline-stage detail** (moved, unchanged): Pipeline Stage funnel, Product-Type Mix, Lead-Source ROI, Top Clients.
6. **Order-stage detail** (moved, unchanged): Order Book by Rep, Bookings vs Invoiced Revenue trend.
7. **Invoice-stage detail** (moved, unchanged): Gross Profit by Rep, Top Customers by Invoiced Revenue, Top Products, Invoiced/Collected/Budget trend.
8. **Payment-stage**: no dedicated chart — content already covered above (KPI tile, funnel bar, stat-strip gap, scorecard's Collected leg, trend chart's Payment line). Not padded with a speculative chart; see Part 6.

**RPC additions** (additive only): `lead_kpis.won_lead_count` (same filter as `won_revenue`), `collected_kpis.payment_count` (same filter as `total_collected`), top-level `resolvedSalesRepCode` (drives drill-through links without a second lookup).

**A deliberate, disclosed judgment call**: putting Pipeline Attainment first in Row 1 revisits a 2026-07 decision to lead with audited SAP data ("that's what the business runs on," per `overviewConfig.js`'s own header comment). Proceeding with funnel-first ordering per explicit direction — severity/urgency signaling stays independent of grid position (a red Invoice Budget tile still visually dominates via `getStatusVariant`'s fill rule regardless of slot), so this changes narrative sequence, not risk-visibility.

---

## Part 5 — Phase 2: "My Sales" individual salesperson self-service page (designed, not built)

**Route**: new sibling route `sales/my-sales` in `SalesRoutes.jsx`, gated `AccessRoute departments={["SAL"]}` — no role restriction (this app's R3 pattern: owning department, staff and manager both use it day-to-day, matching `sales/orders`/`sales/leads` — not the manager-gated `sales/reports`, whose own gate stays untouched).

**Technical shape**: reuse `get_sales_reports_dashboard` unchanged via a curried frontend wrapper, mirroring `fetchMyAttendanceDashboard`'s exact pattern (`src/features/employee/attendance/private/api/myAttendanceService.js`):
```js
// features/sales/reports/private/api/fetchMySalesDashboard.js (new)
export const fetchMySalesDashboard = (employeeId) => async ({ filters }) => {
  const { data, error } = await supabase.rpc("get_sales_reports_dashboard", {
    ...buildSalesReportsParams(filters),  // date range + productType only, no owner picker
    p_owner_id: employeeId,
  });
  if (error) throw error;
  return data;
};
```
Not a second RPC — a second RPC would let the individual and department pages define "Invoice"/"Budget"/"Pipeline" differently over time (the exact class of bug already fixed once, Duality A in `DASHBOARD-ROADMAP.md` §5), and is one more hand-pasted `.sql` file to keep in sync forever. The RPC's self-scoping guard (built alongside Phase 0/1's predecessor work) exists specifically for this.

**Page outline** (`MySales.jsx`, new — clones `Reports.jsx`'s composition per `DASHBOARD-CONVENTIONS.md` §3's "clone the file set" convention):
1. **My KPIs** — same 8-tile shape, personal. Drop Customer Concentration (a portfolio-risk metric meaningless for one person's naturally-concentrated book — its data reappears in Top Accounts below). Add My Estimated Commission — **not built yet, see Part 6 item 1**.
2. **My Quota Progress** — `ScorecardList` fed the self-scoped `invoiceBudgetScorecardData`'s single row. Zero new code.
3. **My Order-to-Cash** (new, action-oriented): a personal 4-bar funnel (same renderer substitution as Phase 1, reshaped from the single scorecard row — zero new RPC fields); "Orders Not Yet Invoiced" (`po_vs_invoice_variance_myr`, when positive), linking to `sales/orders?salesRepCode=<resolvedSalesRepCode>&statusCode=O` (genuinely reachable — `sales/orders` is already `SAL`/no-role-restriction); "Invoiced Not Yet Collected" (`invoice_vs_collected_variance_myr`, when positive) — inline only, no link-out.
4. **Trends** (unchanged shape, personal data): Invoiced/Collected/Budget, Invoice(SAP) vs Pipeline(CRM), Bookings vs Invoiced.
5. **My Pipeline Composition** (unchanged shape — by-stage/product/source/account cuts don't degenerate at n=1): Pipeline Stage, Product-Type Mix, Lead-Source ROI, Top Clients, Top Accounts by Invoiced Revenue (absorbs the dropped Concentration tile's data), Top Products.

**Dropped entirely**: Order Book by Rep and Gross Profit by Rep charts — literal by-rep rankings that collapse to one bar at n=1. Gross Profit folds in as a one-line sub-metric instead.

**Cross-module links**: `sales/orders` links work (real improvement — that route is already `SAL`-gated). Links to `/app/finance/invoices`/`/app/finance/payments` use the exact degrade-to-non-clickable pattern this page already applies to `MGM` viewers today (`to: canAccessX ? path : null`) — no new Finance-adjacent pages built.

---

## Part 6 — Deferred backlog (not built, tracked here)

1. **Commission tile** — decided 2026-08: document only, don't build. Formula would be Invoiced Revenue × `sap_sales_persons.commission_pct`, clearly labeled "Estimated" — gated on Finance/Management confirming the actual commission basis (invoiced vs. collected, tiers, deductions), an open question `DASHBOARD-ROADMAP.md` §6 decision #2 already flags as unresolved.
2. **Stalled Deals signal** (manager coaching tool) — genuinely new SQL, not a free reshape: a "days since last stage movement" CTE off `sales_leads_stage_history.changed_at`, then a `SAL`-only chart (stalled-lead count by rep, >30/45 days no movement).
3. **True Order→Invoice / Invoice→Payment time-in-stage** — `sap_sales_orders`/`sap_invoices` aren't joined to each other anywhere in this RPC today (no shared document key modeled), so an honest days-in-stage figure needs a live-verified `BaseEntry`/`BaseType` document-chain check against `hyrax-data-platform` first, per this repo's research-discipline rule. Phase 1's stat-strip uses value-based gaps instead, not fabricated timing.
4. **Sales-scoped read-only Invoice/Payment list pages** — would fully close the cross-module link gap Phase 2 currently degrades to non-clickable. Bigger, separate lift.
5. **Rolling the RPC's self-scoping guard pattern to Finance/Operations RPCs** — flagged in a prior pass, still pending.

---

## Part 7 — Files touched

- `supabase/sql_editor/get_sales_reports_dashboard_rpc.sql` — Phase 0 fix; Phase 1's `won_lead_count`/`payment_count`/`resolvedSalesRepCode`/`ownerSapMappingMissing` additions.
- `src/pages/user/sales/reports/Reports.jsx` — Phase 1 section reorder, new funnel chart + stat strip, extended scorecard mapping, Needs Attention panel.
- `src/pages/user/sales/reports/config/overviewConfig.js` — Phase 1 tile reorder.
- `src/components/sales/leads/leadsScoreCard/LeadsScoreCard.jsx` — Phase 1 Collected-leg segment.
- `docs/RPC-REFERENCE.md`, `DASHBOARD-CONVENTIONS.md`, `DASHBOARD-ROADMAP.md` — reflect Phase 0/1.
- *(Phase 2, when built)*: `src/pages/user/sales/mySales/MySales.jsx` + `config/overviewConfig.js` (new), `src/features/sales/reports/private/api/fetchMySalesDashboard.js` (new), `src/routes/SalesRoutes.jsx`, `src/data/sideNavLinkData.js`, `departmentLinkCardData.js`, `supabase/access-control/route_access_matrix.csv`.

## Verification

1. **Phase 0**: in Supabase Studio, call the RPC with `p_owner_id` set to an employee with no `employee_sales_rep_mapping.employee_id` row — confirm every SAP-sourced field returns zero/empty, and `ownerSapMappingMissing` is `true`.
2. **Phase 1**: load `sales/reports` as a SAL manager — confirm the funnel chart's four bars match `kpis`' existing totals exactly, the stat strip's counts match a manual count for a known period, and the Rep Funnel Scorecard's Collected column matches `invoiceBudgetScorecardData.collected_myr`. Confirm Needs Attention is visible for a `SAL` manager and absent for an `MGM` viewer.
3. Regression: `sales/reports` with no Salesperson filter selected still matches pre-restructure totals.
4. **Phase 2** (when built): confirm every figure on `sales/my-sales` matches what `sales/reports` shows when manually filtered to that same person via the Salesperson dropdown (same RPC, same params — should be exact); confirm the "Orders Not Yet Invoiced" link lands on a correctly pre-filtered `sales/orders`; confirm Finance-adjacent links render as non-clickable, not dead links.

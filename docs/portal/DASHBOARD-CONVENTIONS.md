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

---

### What this app owns vs. what it doesn't

This app (and its docs) own the IA conventions above, the current build state, and the app-specific build roadmap. It does **not** own the SAP schema, target data architecture, or department-level data-source catalog — that's `hyrax-data-platform/docs/sap-data-architecture-plans/`. Dashboards here get built once that repo has delivered populated, correct tables — don't re-derive SAP table/column semantics in this repo's docs.

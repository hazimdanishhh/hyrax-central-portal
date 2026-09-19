# Finance Module Capabilities

A living tracker of what each Finance module lets users do today vs. what's still missing. This is not a one-time snapshot — update it as work ships (a feature lands, a gap closes, a new gap is found) rather than treating it as a point-in-time audit. For the underlying route/access structure these modules sit behind, see `supabase/access-control/route_access_matrix.csv` and `README.md`; for KPI/RPC-level detail, see `docs/DASHBOARD-CURRENT-STATE.md` and `docs/RPC-REFERENCE.md`.

## Invoices & A/R (tabs: Invoices, Payments)

**What it lets users do today**

- Unified stage badge per row (Paid / Overdue / Due Soon / Open / Paid (Verify)) computed from `outstanding_balance` + `has_paid_mismatch` + `due_date`, collapsing what used to be several separate facts into one glance.
- Rep badge and a rich inline summary of the Matched Sales Order (stage, delivery, invoiced/paid figures) — deliberately not a click-through into Sales' own module (see `docs/DASHBOARD-CONVENTIONS.md` §5); a "View all invoices for this order" link stays within Finance's own Invoices list instead.
- Outstanding-balance KPI tiles and full AR aging/DSO on Financial Reports.
- Tabbed Invoices + Payments under one page (`/app/finance/invoices/list`, `/app/finance/invoices/payments`) — no separate nav item needed to open either.
- Sidebar sections (Line Items, Matched Payment(s)) are collapsible + lazy-loaded; Line Items comes first, Matched Sales Order(s) stays always expanded since it's the primary reason the invoice exists (see `docs/DASHBOARD-CONVENTIONS.md` §6).
- Filterable by `customerCode` (single), `customerCodes` (multi, used by the Sales Order deep-link), and `salesOrderDocEntry` (resolves via the same base_entry/base_type document trail, backing the "View all invoices for this order" link).
- Both tabs' overview KPI strips include a Total tile (added 2026-09) — Invoices': count + gross `total_amount_myr` across every invoice matching the CURRENT filters, including toggles (`hasBalanceOnly`, `overdueOnly`, etc.) the other tiles deliberately ignore, alongside Outstanding/Due Soon/Overdue/Critically Overdue, unchanged (see `get_invoices_overview`'s own `totals_scope` CTE); Payments' Total tile is the same shape, including its own `unallocatedOnly` toggle (see `get_payments_overview`).

**What's missing / not yet built**

- A payment application applied "On Account" (not to a specific invoice) is currently a dead, non-clickable label — a separate in-progress feature (Business Partners page) is fixing this.
- No per-customer statement/aggregate view yet (same fix, see Business Partners below).
- `invoice.overdue`/`invoice.mismatch_detected` notifications are proposed in `docs/NOTIFICATION-RULES-TRACKER.csv` but not implemented — nothing pages/notifies anyone today, it's still "watch and remember."
- A dunning/collections engine, bank-feed reconciliation, and cash-flow forecasting are deliberately NOT planned — SAP B1 already owns these natively, re-building them here would duplicate the system of record.

## Bills & A/P (tabs: Bills, Payments)

**What it lets users do today**

- Same unified stage-badge treatment as Invoices, via `BillCard`.
- Tabbed Bills + Vendor Payments under one page (`/app/finance/bills/list`, `/app/finance/bills/vendor-payments`).
- Filterable by `vendorCode`.
- Full AP aging/DPO on Financial Reports.
- Both tabs' overview KPI strips include a Total tile (added 2026-09) — same shape as Invoices/Payments (see above): count + gross `total_amount_myr` across every bill/vendor payment matching the current filters, including each page's own toggles (`hasBalanceOnly`/`overdueOnly` for Bills, `unallocatedOnly` for Vendor Payments) that the other tiles deliberately ignore.

**What's missing / not yet built**

- Same "On Account" dead-end as Invoices (fix in progress).
- No vendor-side notifications exist or are even proposed yet (asymmetric with AR).
- No per-vendor statement/aggregate view yet.

## Journal Entries

**What it lets users do today**

- Read-only General Ledger audit trail mirroring SAP's OJDT/JDT1.
- Each line's `bp_code` resolves to a real name and links to the correct destination (added 2026-09, fixing a bug from the initial resolve-only-against-customers version): a business partner (Business Partners page) when it genuinely is one, or — since SAP's underlying field can also hold a GL account code instead, found live after the first version shipped — the matching Chart of Accounts entry, labeled "(Account)" so it's never mistaken for a real company. This repo has no live-SAP-data query tool to confirm the exact rule (see CLAUDE.md's research-discipline section), so the resolution is empirical: try `sap_customers` first, `sap_gl_accounts` second.
- Filterable by Business Partner, Account Code, Date Range, Fiscal Year, and Entry Type (closing entries).
- Row-level exception flags (added 2026-09, via a new `sap_gl_journal_entries_with_flags` view): "Unbalanced" — this mirrored entry's debit/credit lines don't sum to zero, framed as a data-sync completeness signal (SAP enforces balanced postings at entry time, so this means the mirror is missing a line, not that SAP itself posted something unbalanced) — and "Posts to a Non-Postable Account," a data-integrity signal.
- Sortable column headers (added 2026-09 — Posting Date/Total Debit/Total Credit/Due Date), via `get_journal_entries_overview`'s own filter-matching "Total" summary line (count + gross debit/credit for whatever's currently filtered) — shown as **plain text, deliberately not an OverviewCards tile**, since this page is structurally an audit trail, not an operational queue (see "What's missing" below and `DASHBOARD-CONVENTIONS.md` §2a).
- No longer the destination for "what GL activity produced this account's balance" (changed 2026-09) — that's now Account Ledger (see below). Journal Entries' own `accountCode`/`bpCode` filters still work as page controls for browsing whole entries by account/partner, but Chart of Accounts and Financial Reports no longer link here for a single-account view.

**What's missing / not yet built**

- No link from a GL line back to its originating source Invoice/Bill — deliberately not built, since no verified base-document reference column exists on `sap_gl_journal_lines` (would need a real schema check before promising it).
- Structurally can never get a "needs action" KPI strip like Invoices did — it's a historical audit trail, not an operational queue, so this is a ceiling, not an oversight. The exception flags above narrow this gap without contradicting it (a row badge, not a strip) — but a broader compliance-reporting layer (regulatory reports, control attestations) still isn't built.
- `trans_type` label mapping is scoped to only the one verified code (`"-3"`, closing entry) — every other code is shown raw pending verification, rather than guessed.
- Whether Finance/accounting staff actually use the new exception flags day-to-day hasn't been validated with real users — this closes a documented capability gap, not a confirmed operational pain point (see `docs/PORTAL-PURPOSE-AND-DEPARTMENT-VALUE.md`'s own honesty convention on this).
- The Total tile's `line_totals` sum is a confirmed, still-open bug when `accountCode`/`bpCode` is filtered — it sums every line of a matching multi-account entry, not just the filtered account/partner's own lines (parked at `docs/claude-plans/2026-09-je-total-line-sum-bug-DEFERRED.md`, deliberately not yet fixed). Account Ledger (below) doesn't have this bug — it never aggregates whole entries.

## Chart of Accounts

**What it lets users do today**

- Read-only mirror of SAP's OACT chart of accounts, with sign-corrected balances (added 2026-09) — `current_balance_myr` is stored debit-positive, so Liabilities/Equity/Revenue accounts now display as positive, human-readable amounts instead of SAP's raw negative stored value (fixes a real display bug; reuses `get_finance_dashboard_rpc.sql`'s own already-verified sign convention).
- Default view (added 2026-09) is a parent-child hierarchy tree using `father_code`/`level`, with title/summary accounts showing a rolled-up balance computed from their postable descendants — falls back to the existing flat, paginated, filterable list the instant a search term or filter is applied.
- Clicking a postable account (`is_postable = 'Y'`) opens its **Account Ledger** (changed 2026-09 — previously jumped straight to Journal Entries filtered by `accountCode`; see Account Ledger below for why that changed).

**What's missing / not yet built**

- The hierarchy tree fetches the full account list unpaginated — a bounded master list at current scale (hundreds of rows, not thousands), so not expected to be an issue, but worth revisiting if the chart of accounts ever grows unusually large.

## Account Ledger (new page, added 2026-09)

Not a tab of Chart of Accounts — a separate route (`/app/finance/chart-of-accounts/:accountCode`) opened by clicking a postable account there, or by clicking a bar on Financial Reports' Operating Expense Breakdown chart. Built to fix a real bug: Chart of Accounts used to jump straight to Journal Entries filtered by `accountCode`, but that filter resolves to whole multi-account journal *entries* that merely contain a line touching the account — then shows entry-wide fields (including the entry's Total Debit/Credit, which bundles every OTHER account's lines in the same entry too), not this account's own activity. Confirmed live, not just a design concern: filtering Journal Entries by "Salaries, bonus & allowance" for FY2026-2027 showed Total Debit = Total Credit = 1,956,551 (a symmetric figure only possible when summing whole balanced entries), while Financial Reports' own per-account Opex Breakdown figure for the same account/period was 567,669.

**What it lets users do today**

- A genuine line-level ledger — one row per posting to this specific account (via a new `sap_gl_journal_lines_with_entry_info` view, joining `sap_gl_journal_lines` to its parent entry for date/memo/reference), each with that line's own debit/credit, not the parent entry's total. Paginated, sortable, filterable by date range/fiscal year, same recipe as every other list page in this app.
- Clicking a ledger row opens the existing Journal Entry detail sidebar (reused as-is, no duplicate component) for that line's full parent entry, if the user wants the multi-line context.
- Business Partner column resolves the same way Journal Entries' own line-items table does (`resolveBpNames.js`, extracted this session as a shared helper once both needed the identical rule) — a real business partner, a GL account (labeled "(Account)"), or the raw code with no link.
- Two charts, side by side, both sourced from one guarded RPC (`get_account_monthly_summary`, reading `private.mv_gl_monthly_account_summary` — not reachable directly from the frontend, same as `get_finance_dashboard_rpc`'s own reasoning) and one always-unbounded fetch sliced/grouped client-side (added 2026-09):
  - **Monthly Balance** — net monthly debit/credit activity, scoped to the page's own date-range/fiscal-year filter (defaults to trailing 12 months when nothing is selected).
  - **Per Annum** — the same monthly figures summed into fiscal years (April–March, same convention as `FiscalYearFilterBar`/`fiscalYearPresets.js` elsewhere in this app), every year on record, ignoring the filter above.
  - An all-time, ungrouped monthly view was built and then dropped during layout review — the RPC/hook still fetch full unbounded history (used by Per Annum's own grouping), just not rendered as its own chart.
  - Both show net debit-credit *flow* for the period shown, not a running point-in-time balance — correct for a P&L account's "how much was spent/earned," but for a Balance Sheet account (Assets/Liabilities/Equity) this is the year's/month's own net movement, not a cumulative balance.
- General-purpose by construction, not one-off wired to either caller — the route takes just `accountCode` (+ optional date range), so any future per-account link elsewhere in the app can point here too, same access gate as Chart of Accounts itself (FIN/MGM department, no role restriction — deliberately looser than `get_finance_dashboard`'s FIN/MGM-manager-only gate).

**What's missing / not yet built**

- No page-level "Total" line (count/gross debit/credit for the currently-filtered lines) — Journal Entries has one via `get_journal_entries_overview`, but that RPC has its own confirmed bug when account-filtered (see Journal Entries' "What's missing" above); Account Ledger doesn't reuse it and hasn't grown an equivalent of its own yet.
- The two charts' flow-vs-balance distinction (noted above) isn't surfaced anywhere except the subtitle text — a Balance Sheet account viewed here could be misread as showing a running balance when it's actually net movement per period.

## Financial Reports

**What it lets users do today**

- Company-wide AR/AP KPIs, full aging, DSO/DPO (via `get_finance_dashboard_rpc`).
- Every tile/chart correctly deep-links into the right Invoices/Payments/Bills/Vendor Payments tab (a set of stale relative-path links here were just fixed).
- Operating Expense Breakdown's bars are individually clickable (added 2026-09) — unlike every other chart here, this one shows 10 different *accounts* as separate bars, so a single whole-card "View All" link (the mechanism every other chart/tile above uses) couldn't point anywhere meaningful; each bar now drills into that account's own Account Ledger (see above), scoped to the currently-selected fiscal year/period. Required adding `account_code` to `opexBreakdownData`'s RPC output (previously only `account_name`) and a new optional `onBarClick` prop on `HorizontalBarChartRenderer`.

**What's missing / not yet built**

- P&L Breakdown / Balance Sheet Snapshot charts are aggregate statement lines (Revenue, COGS, Net Profit), not individual accounts, so they keep their existing whole-card "View All" link to the relevant statement page — no per-bar drill-through for those, unlike Operating Expense Breakdown.
- Otherwise none currently identified beyond what's listed under the modules it links into above.

## Business Partners

**What it lets users do today**

- Look up a single customer or vendor (unified `sap_customers` lookup, broadened beyond Sales' customer/lead-only "SAP Clients" page to default to Customer+Vendor, with a Type filter to also reach Leads) with contact/balance/credit info.
- Preview + "View all" links into that party's Invoices + Payments (customers) or Bills + Vendor Payments (vendors).
- Gives Finance users a real destination when clicking a customer/vendor badge on an Invoice/Payment/Bill/Vendor Payment card — fixes the "On Account" payment-application dead-end (both AR and AP) and a confirmed dead-link bug where Finance-only users hit a Sales-gated page via `SAPCustomerCard`.
- Also the drill-through destination for a Journal Entry line's Business Partner column, when that line's `bp_code` genuinely resolves to one (added 2026-09 — see Journal Entries above for the case where it resolves to a GL account instead).

**What's missing / not yet built**

- No per-business-partner aggregate "total outstanding" figure — no such aggregate view exists server-side yet, only per-document views (`sap_invoices_with_balance`/`sap_vendor_bills_with_balance`).
- Sales has no equivalent RLS access to AP data (vendor bills/payments), so this stays a Finance-only page for the vendor side, by design, not oversight.
- `sap_customers.balance`'s sign/meaning for `card_type = 'S'` (vendor) rows hasn't been independently verified against a known vendor balance — displayed as-is pending that check.

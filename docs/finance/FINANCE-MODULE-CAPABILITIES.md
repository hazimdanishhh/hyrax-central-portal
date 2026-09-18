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

**What's missing / not yet built**

- Same "On Account" dead-end as Invoices (fix in progress).
- No vendor-side notifications exist or are even proposed yet (asymmetric with AR).
- No per-vendor statement/aggregate view yet.

## Journal Entries

**What it lets users do today**

- Read-only General Ledger audit trail mirroring SAP's OJDT/JDT1.
- Each line's `bp_code` is now resolved to a real customer/vendor name (previously a raw, unreadable code).
- Reachable via Chart of Accounts' reverse `accountCode` filter link ("what GL activity produced this account's balance").
- Date-range filterable.

**What's missing / not yet built**

- No link from a GL line back to its originating source Invoice/Bill — deliberately not built, since no verified base-document reference column exists on `sap_gl_journal_lines` (would need a real schema check before promising it).
- Structurally can never get a "needs action" KPI strip like Invoices did — it's a historical audit trail, not an operational queue, so this is a ceiling, not an oversight.

## Chart of Accounts

**What it lets users do today**

- Read-only mirror of SAP's OACT chart of accounts.
- Clicking a postable account (`is_postable = 'Y'`) jumps straight to its Journal Entries, pre-filtered to that account.

**What's missing / not yet built**

- Rendered as a flat list — no hierarchical/tree view using `father_code`/`level` to show the parent-child rollup structure.
- No balance-trend chart — this app has no historized/snapshot layer (no dbt-style materialization), only the live current balance, so a trend view isn't realistic without new data infrastructure.

## Financial Reports

**What it lets users do today**

- Company-wide AR/AP KPIs, full aging, DSO/DPO (via `get_finance_dashboard_rpc`).
- Every tile/chart correctly deep-links into the right Invoices/Payments/Bills/Vendor Payments tab (a set of stale relative-path links here were just fixed).

**What's missing / not yet built**

- None currently identified beyond what's listed under the modules it links into above.

## Business Partners

**What it lets users do today**

- Look up a single customer or vendor (unified `sap_customers` lookup, broadened beyond Sales' customer/lead-only "SAP Clients" page to default to Customer+Vendor, with a Type filter to also reach Leads) with contact/balance/credit info.
- Preview + "View all" links into that party's Invoices + Payments (customers) or Bills + Vendor Payments (vendors).
- Gives Finance users a real destination when clicking a customer/vendor badge on an Invoice/Payment/Bill/Vendor Payment card — fixes the "On Account" payment-application dead-end (both AR and AP) and a confirmed dead-link bug where Finance-only users hit a Sales-gated page via `SAPCustomerCard`.

**What's missing / not yet built**

- No per-business-partner aggregate "total outstanding" figure — no such aggregate view exists server-side yet, only per-document views (`sap_invoices_with_balance`/`sap_vendor_bills_with_balance`).
- Sales has no equivalent RLS access to AP data (vendor bills/payments), so this stays a Finance-only page for the vendor side, by design, not oversight.
- `sap_customers.balance`'s sign/meaning for `card_type = 'S'` (vendor) rows hasn't been independently verified against a known vendor balance — displayed as-is pending that check.

# Account Code → CoA link, and a Journal Entries preview on Business Partners

Not implemented — a written spec only, kept for whenever this is picked up.

## Context

Two small, additive follow-ups from the CoA/JE/Business-Partners work:

1. A Journal Entry line's Account Code isn't clickable, unlike its Business Partner column (fixed in the same round) — the same gap, same fix.
2. The Business Partners page already previews a partner's Invoices/Payments (customers) or Bills/Vendor Payments (vendors), each as a collapsible "capped preview + true count" section. Since `bp_code` on a GL journal line resolves against the exact same `sap_customers` table this page reads (confirmed during the bp_code bug fix), adding a "Journal Entries" preview section here is a natural, low-risk extension of an already-established pattern — not new architecture.

## 1. Account Code → Chart of Accounts link

`src/pages/user/finance/journalEntries/detail/journalLinesTableConfig.jsx`: give the `account_code` column the same `render` treatment the `bp_code` column already has — wrap the value in a `<Link to={`/app/finance/chart-of-accounts?search=${row.account_code}`}>`. No ambiguity to resolve here (unlike `bp_code`, `account_code` on a GL line is always a real GL account, confirmed by the existing `sap_gl_accounts(account_name)` embed already used for this exact column) — simpler than the `bp_code` fix.

## 2. Journal Entries preview on Business Partners

Mirrors the existing Invoices/Payments/Bills/Vendor Payments sections in `BusinessPartnerSidebar.jsx` exactly — same collapsible-section shape, same lazy-loaded `pageSize: 5` hook, same "View all N" drill-through pattern (`buildFilterUrl`, `RouterButton`, true count not capped array length).

- **New hook** `src/features/finance/journalEntries/private/hooks/useJournalEntriesForBusinessPartner.js` — near copy of `useInvoicesForCustomer.js`: calls `fetchJournalEntries({ page: 1, pageSize: 5, filters: { bpCode }, sortBy: "posting_date", sortOrder: "descending" })`, `enabled: !!bpCode && enabled`.
- **New card** `src/components/finance/journalEntryCard/JournalEntryCard.jsx` — simpler than `InvoiceCard`/`PaymentCard` (no paid/outstanding/gross-profit concepts apply to a GL entry). Shows Memo, Reference, Posting Date, Due Date, and Entry Type (reusing the "-3" → "Closing Entry" label already built for the list page). Also surfaces the `is_unbalanced`/`has_nonpostable_posting` exception flags as small status badges when true — genuinely useful here, since this is exactly where a Finance user would notice "this partner's GL activity has a flagged entry." **Deliberately does NOT show `total_debit_myr`/`total_credit_myr`** — those are header-level totals across every line on the entry, not just this partner's line, and showing them next to a business-partner card would misleadingly imply "this is what was posted against this partner."
- **`BusinessPartnerSidebar.jsx`**: add a third preview section, "Journal Entries" (icon `BookOpenIcon`, matching the JE page's own icon), gated by `(isCustomer || isVendor)` — same reasoning as the existing sections' Lead-exclusion (a Lead has no real transacting identity in SAP, so no GL activity to preview either). Uses `selectedRow.customer_code` as the `bpCode` filter (the same field, regardless of card type — confirmed `sap_customers.customer_code` is the one unified key). Drill-through link: `/app/finance/journal-entries${buildFilterUrl({ bpCode: selectedRow.customer_code })}`.

## Files touched (when picked up)

- `src/pages/user/finance/journalEntries/detail/journalLinesTableConfig.jsx`
- `src/features/finance/journalEntries/private/hooks/useJournalEntriesForBusinessPartner.js` (new)
- `src/components/finance/journalEntryCard/JournalEntryCard.jsx` (new)
- `src/pages/user/finance/businessPartners/detail/BusinessPartnerSidebar.jsx`

## Verification (when picked up)

1. `npm run lint` — confirm no new errors.
2. Open a Journal Entry with at least one line, confirm the Account Code now links to Chart of Accounts (search-filtered to that code), same visual treatment as the Business Partner column.
3. Open a Business Partner (both a customer and a vendor, if known test data exists) that has GL activity, confirm the new "Journal Entries" section shows up to 5 recent entries, the "View all N" link goes to Journal Entries filtered by that partner, and an entry with an exception flag (if one exists) shows its badge on the card.

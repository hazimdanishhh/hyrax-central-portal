# Unbounded-`.select()` truncation bug — full codebase audit and fix log

## What this is

A real, confirmed production bug: a Supabase query doing `.from(table).select(...).eq(...)` with **no `.range()`/`.limit()`** silently truncates at a server-side default row cap (confirmed live: account `7000120`'s Journal Entries drill-through had 1,946 real matching `sap_gl_journal_lines` rows spanning to 2026-06-26, but the unbounded fetch only ever surfaced ~1000 of them, collapsing to 864 distinct `trans_id`s after client-side dedup — making the drill-through look like it stopped in 2021, with zero error anywhere). The fix: a shared helper, `src/functions/fetchAllSupabaseRows.js`, which pages through `.range()` until a page comes back short, requiring an explicit deterministic `.order()` (pagination without one can skip/duplicate rows across page boundaries).

**This is a pattern, not a one-off** — any Supabase query with this shape (unbounded, outside the `usePaginatedQuery` primary-list pattern which already applies `.range()` correctly) carries the same risk if the underlying result set can exceed the row cap. A full, four-pass audit was run across the entire `src/` tree on 2026-09 to find every instance. This doc is the record of what was found and fixed, and what's intentionally deferred.

## Fixed (7 files, 2026-09)

All now use `fetchAllSupabaseRows` with an explicit deterministic order:

1. `src/features/finance/journalEntries/private/api/journalEntriesService.js` → `resolveTransIdsByLineColumn` — **the confirmed real-world case.**
2. `src/features/finance/invoices/private/api/invoicesService.js` → `resolveInvoiceIdsForSalesOrder`
3. `src/features/finance/payments/private/api/paymentsService.js` → `resolvePaymentIdsForInvoices`, `fetchPaymentsForInvoice`
4. `src/features/finance/payments/private/api/fetchPaymentApplications.js` → `fetchPaymentApplications`
5. `src/features/finance/vendorPayments/private/api/vendorPaymentsService.js` → `fetchVendorPaymentsForBill`
6. `src/features/finance/vendorPayments/private/api/fetchVendorPaymentApplications.js` → `fetchVendorPaymentApplications`
7. `src/features/sales/orders/private/api/salesOrdersService.js` → `fetchSalesOrdersForInvoice`
8. `src/features/workspace/tasks/private/api/tasksByProjectService.js` → `fetchTasksByProject` (own header comment had already flagged this as deferred debt — closed now)
9. `src/features/workspace/tasks/private/api/projectDocumentsService.js` → `fetchProjectDocuments`

(9 functions across 8 files — `paymentsService.js` had two.)

## Audited clean — confirmed no other instance of the bug

Full sweep covered: `src/features/finance/**`, `src/features/sales/**`, `src/features/hr/**`, `src/features/employee/**`, `src/features/workspace/**`, `src/features/it/**`, `src/features/system/**`, `src/features/superadmin/**`, `src/features/notifications/**`, `src/features/_shared/**`, `src/hooks/**`, `src/context/**`, `src/lib/**`, `src/pages/**`, `src/components/**`, `src/features/aiSummary/**`, `src/functions/**`. Every primary `usePaginatedQuery`-backed list page correctly applies `.range()` last. Every dropdown/typeahead search correctly `.limit(20)`s. Every single-row lookup correctly ends in `.single()`/`.maybeSingle()`. Attendance/leave data (the largest tables outside GL) were already hardened against this exact bug in the past, before this audit.

## Deliberately deferred — not fixed, documented for a future pass

These share the code shape (`.select()` with no `.range()`/`.limit()`) but are a **different risk profile**: not "a filtered subset that could exceed 1000 rows," but "the entire table, fetched with no filter at all, that could grow past 1000 rows over time." Currently small/bounded by real-world scale (headcount, rep count, asset inventory), explicitly commented as intentional in a couple of cases. Worth revisiting if any of these tables' natural size grows meaningfully:

- `src/features/sales/leads/private/api/leadsOverview.js` → `fetchLeadsOverview` — entire `sales_leads` table, no filter/limit at all. The one case here with *zero* natural bound of any kind (not headcount/asset-count scale) — highest priority of this deferred group if `sales_leads` ever grows large.
- `src/features/sales/orders/private/api/salesOrdersService.js` → `fetchRepsByCode`/`fetchRepNamesByCode` (and their `salesOrdersMetadataService.js` duplicates) — full `sap_sales_persons`/`employee_sales_rep_mapping` reads, bounded by rep headcount.
- `src/features/it/assets/private/api/itAssetsOverview.js` → `fetchITAssetsOverview` — full `it_assets` table, bounded by device inventory.
- `src/features/superadmin/users/private/api/profilesOverview.js` → `fetchProfilesOverview` — full `profiles`+`employees` reads, explicitly commented as intentional ("small dataset").
- `src/features/superadmin/users/private/api/employeeLink.js` → `fetchUnlinkedEmployees` — full `employees` table filtered by null `profile_id`, bounded by headcount.

**Convention note (not a pagination bug, found during the same audit):** three files bypass the feature-service-file convention with inline Supabase calls directly in a page/component rather than a `private/api/*.js` file — `AttendanceManagement.jsx`/`TeamAttendance.jsx` (inline `supabase.rpc("approve_attendance"/"reject_attendance")`) and `GenerateAIButton.jsx` (`supabase.functions.invoke`). None carry the truncation risk (single-row RPCs / edge function calls), but worth knowing about if this convention ever gets formally enforced.

## If you're picking this up in a future session

Before adding any new "resolve matching rows"-shaped Supabase query, check whether the result set could plausibly exceed ~1000 rows for a real company's accumulated data — if there's no natural single-document/single-user scope bounding it, use `fetchAllSupabaseRows` from the start rather than adding it retroactively after a real user hits it, the way this round did.

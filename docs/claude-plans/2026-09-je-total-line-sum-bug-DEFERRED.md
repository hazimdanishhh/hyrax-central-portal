# DEFERRED: Fix Journal Entries "Total" summing whole entries, not the filtered account/partner's own lines

**Status: designed, not yet applied.** Deliberately parked (2026-09-19) so the Opex Breakdown drill-down design could be worked first — pick this back up whenever, it doesn't depend on that other work.

## Context

Confirmed real bug, not a data or design difference: filtering Journal Entries by Account Code = "Salaries, bonus & allowance" for FY2026-2027 shows Total Debit = Total Credit = 1,956,551, while Financial Reports' Operating Expense Breakdown (a genuinely per-account figure) shows 567,669 for the same account/period. The tell: Total Debit exactly equaling Total Credit only happens when summing whole, internally-balanced multi-line entries — not one account's own (mostly debit-only) activity.

**Root cause**: `get_journal_entries_overview_rpc.sql`'s `line_totals` CTE joins `sap_gl_journal_lines` to `base_entries` (the set of `trans_id`s that have *some* line matching the `accountCode`/`bpCode` filter) but sums **every line of those entries**, not just the lines that actually match the filter. So filtering by one account correctly narrows *which entries* are included, but then incorrectly sums the *entire entry* (every other account/line bundled into the same journal entry — e.g. a combined monthly payroll posting covering Salaries, EPF, Socso, Medical, etc. all in one entry) instead of just that account's own contribution.

This only matters when `accountCode`/`bpCode` is set. With no such filter, every line of every matching entry legitimately belongs to the result set (there's no specific account being isolated), so the current behavior is already correct in that case — the fix must be conditional, not a blanket change.

## Fix

In `get_journal_entries_overview_rpc.sql`'s `line_totals` CTE, add the same account/bp restriction to the actual sum, not just to the entry-selection `EXISTS` checks:

```sql
line_totals as (
    select
        coalesce(sum(jl.debit_amount_myr), 0) as total_debit_myr,
        coalesce(sum(jl.credit_amount_myr), 0) as total_credit_myr
    from public.sap_gl_journal_lines jl
    join base_entries be on be.trans_id = jl.trans_id
    where (p_account_code is null or jl.account_code = p_account_code)
      and (p_bp_code is null or jl.bp_code = p_bp_code)
)
```

When neither filter is set, this is a no-op (unchanged behavior — sums every line of every matching entry, correct for that case). When `accountCode` is set, only lines actually posted to that account contribute to the sum — matching Financial Reports' own per-account figure exactly (both ultimately derive from the same `sap_gl_journal_lines.debit_amount_myr`/`credit_amount_myr` columns, just via different aggregation paths, so they should now reconcile up to the closing-entries difference noted above).

No frontend changes needed — `fetchJournalEntriesOverview`/`useJournalEntriesOverview`/the page's Total display already just render whatever the RPC returns.

## Files touched

- `supabase/sql_editor/get_journal_entries_overview_rpc.sql`

## Verification

1. Re-run the fixed SQL in the Supabase SQL editor (confirm with the user first, since this is a live database change).
2. Reload Journal Entries filtered by Account Code = "Salaries, bonus & allowance" + FY2026-2027 — confirm Total Debit and Total Credit are no longer identical to each other, and that the debit figure now lands close to Financial Reports' 567,669 (allowing for the separate, expected closing-entries difference noted above, not a new bug).
3. Spot-check the no-filter case (just a date range, no account/bp code) still shows the same total as before this fix — confirms the conditional restriction didn't change that behavior.

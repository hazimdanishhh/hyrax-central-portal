-- Run this once in the Supabase SQL editor.
--
-- Backs the Journal Entries list page's "Total" summary -- count + gross
-- debit/credit across every entry matching the CURRENT filters, same
-- "matches the table exactly" intent as get_invoices_overview's own Total
-- tile. Deliberately NOT rendered as an OverviewCards KPI card on the
-- frontend -- see JournalEntries.jsx's own comment: this page is
-- structurally an audit trail, not an operational queue
-- (docs/finance/FINANCE-MODULE-CAPABILITIES.md), and a KPI-card strip on
-- flat/audit-trail data is "decoration, not decision support" per
-- docs/portal/DASHBOARD-CONVENTIONS.md §2a. The RPC still exists because the
-- underlying NUMBER is genuinely useful; only its PRESENTATION differs from
-- Invoices/Bills (plain text, not a card).
--
-- Plain function (NOT security definer) -- runs with the caller's own
-- row-security context, same as every other overview RPC in this app.
--
-- PERFORMANCE CAUTION (2026-09): sap_gl_journal_lines is confirmed 620K+
-- rows and growing daily, sap_gl_journal_entries 156K+ -- the same table
-- pair whose unindexed lateral join already caused a real, confirmed
-- production timeout once this session (see finance_gl_entry_flags_view.sql
-- and journalEntriesService.js's own fetchJournalEntries comment). This RPC
-- filters base_entries FIRST directly against sap_gl_journal_entries (cheap
-- boolean predicates, no join needed unless accountCode/bpCode is set),
-- THEN joins to sap_gl_journal_lines only for entries that already passed
-- the filter -- using the idx_sap_gl_journal_lines_trans_id index added
-- alongside finance_gl_entry_flags_view.sql. This is a single-pass
-- count+sum aggregate, not a per-row lateral evaluation for pagination
-- metadata (the actual shape that caused the earlier timeout) -- but the
-- default/no-filter case still touches the full unfiltered history, same
-- as every other overview RPC's own default behavior in this app
-- (get_invoices_overview etc. also aggregate their full base table
-- unfiltered). Watch this specifically if it proves slow in practice --
-- the next lever, if needed, would be requiring at least a date range
-- before running, mirroring how incomeStatementData/cashFlowStatementData
-- in get_finance_dashboard_rpc.sql are null-gated behind an explicit period.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- this is a brand-new
-- function, no prior overload to drop.
create or replace function public.get_journal_entries_overview(
    p_search text default null,
    p_start_date date default null,
    p_end_date date default null,
    p_entry_type text default null,
    p_account_code text default null,
    p_bp_code text default null
)
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_entries as (
        select je.trans_id
        from public.sap_gl_journal_entries je
        where (
                p_search is null
                or je.memo ilike '%' || p_search || '%'
                or je.reference_1 ilike '%' || p_search || '%'
              )
          and (p_start_date is null or je.posting_date::date >= p_start_date)
          and (p_end_date is null or je.posting_date::date <= p_end_date)
          -- Only "-3" (SAP B1's reserved period-end closing entry) is a
          -- verified trans_type code in this codebase -- mirrors
          -- journalEntriesService.js's own entryType filter exactly.
          and (
                p_entry_type is null
                or (p_entry_type = 'closingOnly' and je.trans_type = '-3')
                or (p_entry_type = 'excludeClosing' and je.trans_type <> '-3')
              )
          and (
                p_account_code is null
                or exists (
                    select 1 from public.sap_gl_journal_lines jl
                    where jl.trans_id = je.trans_id
                      and jl.account_code = p_account_code
                )
              )
          and (
                p_bp_code is null
                or exists (
                    select 1 from public.sap_gl_journal_lines jl
                    where jl.trans_id = je.trans_id
                      and jl.bp_code = p_bp_code
                )
              )
    ),
    line_totals as (
        select
            coalesce(sum(jl.debit_amount_myr), 0) as total_debit_myr,
            coalesce(sum(jl.credit_amount_myr), 0) as total_credit_myr
        from public.sap_gl_journal_lines jl
        join base_entries be on be.trans_id = jl.trans_id
    )
    select json_build_object(
        'totalCount', (select count(*) from base_entries),
        'totalDebitMyr', (select total_debit_myr from line_totals),
        'totalCreditMyr', (select total_credit_myr from line_totals)
    )
    into result;

    return result;
end;
$$;

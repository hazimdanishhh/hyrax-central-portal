-- Run this once in the Supabase SQL editor.
--
-- Adds the "compliance/exception layer" Journal Entries was missing (see
-- docs/finance/FINANCE-MODULE-CAPABILITIES.md's own "what's missing" note)
-- as real, filterable/flaggable columns -- same reasoning as
-- finance_outstanding_balance_views.sql's outstanding_balance/
-- has_paid_mismatch: PostgREST can't filter/flag on an arithmetic
-- comparison across two tables directly, so the aggregation has to be
-- computed here to become a real column DataTable's getRowFlags can read.
--
-- is_unbalanced: abs(total_debit_myr - total_credit_myr) > 0.01. Framed
-- deliberately as a DATA-SYNC COMPLETENESS signal in the UI, not "SAP itself
-- posted an unbalanced entry" -- SAP enforces balanced postings per
-- transaction at entry time, so a mismatch here means this app's own mirror
-- of sap_gl_journal_lines is missing a line for this trans_id, not that the
-- underlying GL is actually out of balance. Same 0.01 epsilon guard used
-- throughout this app for floating-point-settled sums.
--
-- has_nonpostable_posting: true if ANY line on this entry posts to an
-- account with is_postable = 'N' -- a genuine data-integrity signal if it
-- ever fires (a non-postable/title account should never receive a direct
-- posting). Left-joins sap_gl_accounts defensively (coalesce to 'Y', i.e.
-- "not flagged") for the rare case a line's account_code doesn't resolve at
-- all, rather than a bare NULL silently propagating into a wrong true/false.
--
-- Uses `left join lateral` (not a pre-aggregated `group by` derived table)
-- so Postgres can correlate/push the je.trans_id predicate down per row --
-- same reasoning as finance_outstanding_balance_views.sql's own
-- applied_payment_myr lateral join.
create or replace view public.sap_gl_journal_entries_with_flags as
select
    je.*,
    coalesce(agg.total_debit_myr, 0) as total_debit_myr,
    coalesce(agg.total_credit_myr, 0) as total_credit_myr,
    (abs(coalesce(agg.total_debit_myr, 0) - coalesce(agg.total_credit_myr, 0)) > 0.01) as is_unbalanced,
    coalesce(agg.has_nonpostable_posting, false) as has_nonpostable_posting
from public.sap_gl_journal_entries je
left join lateral (
    select
        sum(jl.debit_amount_myr) as total_debit_myr,
        sum(jl.credit_amount_myr) as total_credit_myr,
        bool_or(coalesce(a.is_postable, 'Y') = 'N') as has_nonpostable_posting
    from public.sap_gl_journal_lines jl
    left join public.sap_gl_accounts a on a.account_code = jl.account_code
    where jl.trans_id = je.trans_id
) agg on true;

-- CRITICAL -- without this the view silently runs as its OWNER (the role
-- that pasted this script), not the querying user, meaning
-- sap_gl_journal_entries' existing RLS never actually applies through it --
-- same gap finance_outstanding_balance_views.sql's own critical comment
-- already fixed once for sap_invoices_with_balance/
-- sap_vendor_bills_with_balance.
alter view public.sap_gl_journal_entries_with_flags set (security_invoker = on);

-- CRITICAL -- without these, the lateral join above is a full scan of
-- sap_gl_journal_lines per row of sap_gl_journal_entries. Confirmed real,
-- not theoretical: sap_gl_journal_lines is 620K+ rows and growing daily
-- (get_finance_dashboard_rpc.sql's own comment, from a prior live 57014
-- statement-timeout incident on these exact tables) -- over 30x this app's
-- general "~20k rows" DASHBOARD-CONVENTIONS.md scale note. Same precedent
-- sap_sales_orders_with_fulfillment_view.sql already established for its
-- own lateral joins' base_entry/base_type predicates.
create index if not exists idx_sap_gl_journal_lines_trans_id on public.sap_gl_journal_lines(trans_id);
create index if not exists idx_sap_gl_journal_lines_account_code on public.sap_gl_journal_lines(account_code);
create index if not exists idx_sap_gl_accounts_account_code on public.sap_gl_accounts(account_code);

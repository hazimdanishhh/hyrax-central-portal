-- Run this once in the Supabase SQL editor.
--
-- Backs the new Account Ledger page (Chart of Accounts -> click a postable
-- account) -- one row per LINE posted to that account, not per whole journal
-- entry. Added 2026-09 to fix a real problem: filtering the header-level
-- Journal Entries list by accountCode resolves to whole multi-line entries
-- that merely CONTAIN a line touching the account, then shows entry-wide
-- fields (including the entry's Total Debit/Credit, which bundles every
-- OTHER account's lines in the same entry too) -- not this account's own
-- activity. A plain view join (not a materialized view, not the lateral-
-- aggregate sap_gl_journal_entries_with_flags) keeps this cheap: filtering
-- by account_code happens on the indexed base table first
-- (idx_sap_gl_journal_lines_account_code, added in
-- finance_gl_entry_flags_view.sql), so the join only ever touches the
-- entries that already matched -- no per-row lateral subquery like the
-- flags view has (that shape is what caused a real confirmed timeout on
-- these same tables once already -- see journalEntriesService.js's own
-- fetchJournalEntries comment).
create or replace view public.sap_gl_journal_lines_with_entry_info as
select
    jl.*,
    je.posting_date,
    je.due_date,
    je.memo,
    je.reference_1,
    je.reference_2,
    je.trans_type
from public.sap_gl_journal_lines jl
join public.sap_gl_journal_entries je on je.trans_id = jl.trans_id;

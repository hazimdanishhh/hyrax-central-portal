-- Run this once in the Supabase SQL editor.
--
-- Backs the Account Ledger AND Category Detail pages' monthly trend charts
-- -- "how much is this account (or category) per month." Added 2026-09
-- alongside sap_gl_journal_lines_with_entry_info_view.sql, as part of the
-- same Chart of Accounts / Financial Reports drill-down feature.
--
-- GENERALIZED 2026-09 (same signature, no DROP needed) to sum over every
-- POSTABLE DESCENDANT of p_account_code, not just p_account_code itself --
-- built for the new Category Detail page (non-postable/title accounts),
-- which needs a whole category's aggregate movement, not one account's.
-- This is a strict superset of the original behavior: a postable leaf
-- account has no children, so "every postable descendant of X" trivially
-- resolves to just X -- Account Ledger's own already-shipped numbers are
-- unaffected. The descendant walk mirrors get_finance_dashboard_rpc.sql's
-- own gl_account_ancestry_raw CTE, just inverted -- that one walks UPWARD
-- from a postable leaf to its Level-2/3 ancestor via father_code; this one
-- walks DOWNWARD from any account (leaf or category) to every postable
-- descendant.
--
-- Reads private.mv_gl_monthly_account_summary (month + account_code grain,
-- excludes SAP B1's period-end closing entries at the view level -- see
-- get_finance_dashboard_rpc.sql's own base_gl_lines comment) instead of a
-- live join across sap_gl_journal_lines/sap_gl_journal_entries -- same
-- reasoning as that RPC's own base_gl_lines CTE, just scoped to one
-- account's descendant set instead of every account.
--
-- SECURITY INVOKER (not DEFINER) -- mirrors get_finance_dashboard's own
-- comment exactly: private isn't in PostgREST's exposed-schemas list, so it
-- isn't routable via the REST API at all regardless of the grants that let
-- this function's own query still succeed. No DEFINER escalation needed.
--
-- Authorization guard mirrors Chart of Accounts'/Journal Entries' own route
-- gate (FIN or MGM department, any role, superadmin bypass) -- deliberately
-- NOT get_finance_dashboard's stricter FIN/MGM-manager-only gate. This
-- exposes far less than the full dashboard (one account's own monthly
-- activity, already visible in aggregate via Chart of Accounts' own balance
-- and Financial Reports' Opex Breakdown), and is reached from Chart of
-- Accounts, which already uses the looser department-only gate.
--
-- p_start_date/p_end_date follow this app's own null-means-unbounded
-- convention (same as every other RPC here) -- this function does NOT
-- default to a trailing-12-months window itself; the frontend
-- (AccountLedger.jsx) computes that default when the URL has no explicit
-- range, so this RPC's null semantics never drift from every other RPC's.
create or replace function public.get_account_monthly_summary(
    p_account_code text,
    p_start_date date default null,
    p_end_date date default null
)
returns json
language plpgsql
security invoker
as $$
declare
    result json;
    v_role_name text;
    v_department_sub text;
    v_drawer int;
begin
    select r.name, d.sub
    into v_role_name, v_department_sub
    from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid();

    if v_role_name is distinct from 'superadmin'
       and v_department_sub not in ('FIN', 'MGM')
    then
        raise exception 'Unauthorized: get_account_monthly_summary requires FIN/MGM or superadmin' using errcode = '42501';
    end if;

    -- Sign convention matches glBalanceSign.js/get_finance_dashboard_rpc.sql
    -- exactly: mv_gl_monthly_account_summary's debit/credit columns are
    -- debit-positive; Liabilities/Equity/Revenue (drawers 2/3/4) negate.
    -- Every descendant shares p_account_code's own drawer, so one lookup
    -- covers the whole set below.
    select drawer into v_drawer
    from public.sap_gl_accounts
    where account_code = p_account_code;

    with recursive descendants as (
        -- Seed on the clicked account itself, then walk DOWNWARD via
        -- father_code -- inverted from gl_account_ancestry_raw's own upward
        -- walk in get_finance_dashboard_rpc.sql. Includes p_account_code
        -- itself so a postable leaf (no children) still resolves to its own
        -- single row.
        select account_code, is_postable
        from public.sap_gl_accounts
        where account_code = p_account_code

        union all

        select a.account_code, a.is_postable
        from public.sap_gl_accounts a
        join descendants d on a.father_code = d.account_code
    ),
    postable_descendants as (
        select account_code from descendants where is_postable = 'Y'
    ),
    monthly as (
        select
            month,
            sum(debit_amount_myr - credit_amount_myr) as raw_balance_myr
        from private.mv_gl_monthly_account_summary
        where account_code in (select account_code from postable_descendants)
          and (p_start_date is null or month >= date_trunc('month', p_start_date))
          and (p_end_date is null or month <= date_trunc('month', p_end_date))
        group by month
    )
    select coalesce(json_agg(
        json_build_object(
            'month', month,
            'balanceMyr', case when v_drawer in (2, 3, 4) then -raw_balance_myr else raw_balance_myr end
        )
        order by month
    ), '[]'::json)
    into result
    from monthly;

    return result;
end;
$$;

-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Vendor Payments list page's OverviewCards -- AP
-- mirror of get_payments_overview_rpc.sql. Plain function (NOT security
-- definer), relies on sap_vendor_payments' existing RLS.
--
-- Filter-aware (added 2026-09), AP mirror of get_payments_overview's own
-- filter treatment: p_start_date/p_end_date scope payment_date --
-- independently null-guarded, per DASHBOARD-CONVENTIONS.md's date-range rule
-- -- and simply AND with the existing thisWeek/thisMonth relative-to-today
-- windows below (picking a historical period will naturally zero those out
-- -- expected, not a bug). p_is_cancelled defaults to excluding cancelled
-- docs ('N') when not supplied. Deliberately NOT parameterized:
-- unallocatedOnly -- that toggle is what this page's own Unallocated tile
-- sets on the list when clicked, so feeding it back in here would be
-- circular. Don't add it here.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- Postgres identifies a
-- function by name + parameter *types*, so the previous zero-argument
-- get_vendor_payments_overview() is a genuinely different signature and
-- would otherwise keep existing as a second, separate overload after this
-- file is re-run, silently coexisting alongside the parameterized version
-- below. The explicit drop guarantees only one overload survives -- run it
-- first.
drop function if exists public.get_vendor_payments_overview();

create or replace function public.get_vendor_payments_overview(
    p_vendor_code text default null,
    p_is_cancelled text default null,
    p_start_date date default null,
    p_end_date date default null,
    p_search text default null
)
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_vendor_payments as (
        select *
        from public.sap_vendor_payments
        where (
                case when p_is_cancelled is null then is_cancelled = 'N'
                     else is_cancelled = p_is_cancelled
                end
              )
          and (p_vendor_code is null or vendor_code = p_vendor_code)
          and (p_start_date is null or payment_date::date >= p_start_date)
          and (p_end_date is null or payment_date::date <= p_end_date)
          and (
                p_search is null
                or vendor_name ilike '%' || p_search || '%'
                or (p_search ~ '^\d+$' and payment_number::text = p_search)
              )
    )
    select json_build_object(
        'unallocatedCount', count(*) filter (where unallocated_amount > 0.01),
        'unallocatedValue', coalesce(sum(unallocated_amount) filter (where unallocated_amount > 0.01), 0),

        'thisWeekCount', count(*) filter (where payment_date::date >= current_date - 7),
        'thisWeekValue', coalesce(sum(total_amount_myr) filter (where payment_date::date >= current_date - 7), 0),

        'thisMonthCount', count(*) filter (where payment_date::date >= date_trunc('month', current_date)),
        'thisMonthValue', coalesce(sum(total_amount_myr) filter (where payment_date::date >= date_trunc('month', current_date)), 0)
    )
    into result
    from base_vendor_payments;

    return result;
end;
$$;

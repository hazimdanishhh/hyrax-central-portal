-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Vendor Payments list page's OverviewCards -- AP
-- mirror of get_payments_overview_rpc.sql. Plain function (NOT security
-- definer), relies on sap_vendor_payments' existing RLS.
create or replace function public.get_vendor_payments_overview()
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_vendor_payments as (
        select *
        from public.sap_vendor_payments
        where is_cancelled = 'N'
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

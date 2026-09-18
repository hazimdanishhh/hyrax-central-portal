-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Fulfillment Tracker page's OverviewCards -- plain
-- function (NOT security definer), so it runs with the caller's own
-- row-security context. It reads sap_sales_orders_with_fulfillment, which is
-- already security_invoker = on (see that view's own file), so
-- sap_sales_orders'/sap_invoices_with_balance's per-department RLS policies
-- scope every figure below to exactly what this caller already sees via
-- fetchFulfillmentOrders() -- same reasoning as get_sales_orders_overview.
--
-- No `drop function if exists` needed here (unlike get_invoices_overview /
-- get_sales_orders_overview, which each had a pre-existing zero-argument
-- overload to kill): get_fulfillment_overview has never been deployed in any
-- signature.
--
-- Filter-aware, matching fetchFulfillmentOrders()'s own filter set so this
-- strip always summarizes exactly the rows the list would show. Every param
-- is null-guarded independently. p_is_cancelled defaults to excluding
-- cancelled docs ('N'), matching get_invoices_overview/
-- get_sales_orders_overview -- and load-bearing here beyond mere
-- consistency: a cancelled SAP order keeps its RDR1.OpenQty forever, so
-- without this default every cancelled order would sit in Open Backlog
-- permanently. This IS a deliberate divergence from the list itself
-- (fetchFulfillmentOrders applies no cancelled default), the same accepted
-- divergence get_invoices_overview already carries; every tile's own
-- drill-through filter carries isCancelled:"N" so tile count == list count.
--
-- Deliberately NOT parameterized: deliveryStatus / invoicedOnly /
-- fullyPaidOnly / hasMismatchOnly / deliveryOverdueOnly. Those five are
-- precisely what this page's own KPI tiles set on the list when clicked, so
-- feeding them back in would be circular (deliveryStatus='delivered' would
-- force backlogCount to 0 by definition). Same rule as get_invoices_overview's
-- overdueOnly/dueSoonOnly. leadMatchedOnly IS parameterized -- no tile sets
-- it, so it's non-circular.
create or replace function public.get_fulfillment_overview(
    p_customer_code text default null,
    p_sales_rep_code bigint default null,
    p_status_code text default null,
    p_is_cancelled text default null,
    p_lead_matched_only boolean default null,
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
    with base_orders as (
        select *
        from public.sap_sales_orders_with_fulfillment
        where (
                case when p_is_cancelled is null then is_cancelled = 'N'
                     else is_cancelled = p_is_cancelled
                end
              )
          and (p_customer_code is null or customer_code = p_customer_code)
          and (p_sales_rep_code is null or sales_rep_code = p_sales_rep_code)
          and (p_status_code is null or status_code = p_status_code)
          -- `is not true` (not `is null or`) so an explicit false behaves
          -- like the service's own no-op "All" branch rather than inverting.
          and (p_lead_matched_only is not true or has_matched_lead)
          and (p_start_date is null or order_date::date >= p_start_date)
          and (p_end_date is null or order_date::date <= p_end_date)
          and (
                p_search is null
                or customer_name ilike '%' || p_search || '%'
                or customer_ref ilike '%' || p_search || '%'
                or (p_search ~ '^\d+$' and so_number::text = p_search)
              )
    )
    select json_build_object(
        -- 1. OPEN BACKLOG (hero) -- orders SAP still considers open whose
        -- delivery isn't complete. is_fully_delivered is the view's own
        -- (total_open_qty <= 0), i.e. SAP's live RDR1.OpenQty rollup -- the
        -- proven fulfillment signal, NOT sap_deliveries, which has had zero
        -- rows since 2022-05-25.
        --
        -- status_code = 'O' is a deliberate ACTIONABILITY gate, not a
        -- delivered-signal: SAP B1 can manually close an order that's still
        -- partially open, so a closed order with leftover open_qty is a
        -- deliberate business decision to stop, not live backlog.
        --
        -- backlogValue is the FULL order value of those orders, not the
        -- undelivered portion -- sap_sales_order_lines carries open_qty but
        -- this view rolls up only quantities, not open line value.
        -- backlogOpenQty is the honest "how much is actually still out
        -- there" figure.
        'backlogCount', count(*) filter (
            where status_code = 'O' and not is_fully_delivered
        ),
        'backlogValue', coalesce(sum(total_amount_myr) filter (
            where status_code = 'O' and not is_fully_delivered
        ), 0),
        'backlogOpenQty', coalesce(sum(total_open_qty) filter (
            where status_code = 'O' and not is_fully_delivered
        ), 0),

        -- 2. OVERDUE DELIVERY -- the aging dimension backlog alone lacks.
        -- delivery_date is SAP's DocDueDate (the requested delivery date).
        --
        -- nullif(delivery_date, '')::date, not a bare cast: delivery_date is
        -- raw SAP-extracted TEXT, so an empty string would raise 22007 on
        -- cast. A null result makes the comparison null, which the FILTER
        -- clause drops -- the correct reading ("no promised date" is not
        -- overdue).
        'overdueDeliveryCount', count(*) filter (
            where status_code = 'O' and not is_fully_delivered
              and nullif(delivery_date, '')::date < current_date
        ),
        'overdueDeliveryValue', coalesce(sum(total_amount_myr) filter (
            where status_code = 'O' and not is_fully_delivered
              and nullif(delivery_date, '')::date < current_date
        ), 0),

        -- 3. DELIVERED, NOT INVOICED -- goods out, nothing billed. No
        -- status_code gate on purpose: a CLOSED, fully delivered, uninvoiced
        -- order is still an unbilled-revenue gap, arguably a worse one.
        -- matched_invoice_count is the view's own union of the direct
        -- (base_type=17) and via-delivery (base_type=15) invoice paths, so
        -- "= 0" genuinely means no invoice exists by either route.
        'deliveredNotInvoicedCount', count(*) filter (
            where is_fully_delivered and matched_invoice_count = 0
        ),
        'deliveredNotInvoicedValue', coalesce(sum(total_amount_myr) filter (
            where is_fully_delivered and matched_invoice_count = 0
        ), 0),

        -- 4. INVOICED, NOT FULLY PAID -- uncollected cash on delivered/billed
        -- work. Sums total_outstanding_myr (the view's rollup of
        -- sap_invoices_with_balance.outstanding_balance = total_amount_myr -
        -- paid_to_date), NOT total_amount_myr: the actual uncollected
        -- amount, the same formula the Invoices page already uses.
        --
        -- is_fully_paid is structurally (matched_invoice_count > 0 AND
        -- total_outstanding_myr <= 0.01), so `matched_invoice_count > 0 and
        -- not is_fully_paid` is exactly "has invoices with a real remaining
        -- balance".
        'outstandingCount', count(*) filter (
            where matched_invoice_count > 0 and not is_fully_paid
        ),
        'outstandingValue', coalesce(sum(total_outstanding_myr) filter (
            where matched_invoice_count > 0 and not is_fully_paid
        ), 0),

        -- PAYMENT MISMATCH -- data-quality flag, rendered as a sub-metric of
        -- tile 4 rather than its own tile (usually 0). has_paid_mismatch is
        -- the view's abs(total_paid_myr - total_applied_myr) > 0.01: SAP's
        -- own OINV paid_to_date running total disagreeing with the RCT2
        -- application rows. No invoices => both sums 0 => abs(0-0) = 0 =>
        -- false, so no extra guard is needed. mismatchValue is the SIZE of
        -- the discrepancy, not the order value.
        'mismatchCount', count(*) filter (where has_paid_mismatch),
        'mismatchValue', coalesce(sum(abs(total_paid_myr - total_applied_myr))
            filter (where has_paid_mismatch), 0)
    )
    into result
    from base_orders;

    return result;
end;
$$;

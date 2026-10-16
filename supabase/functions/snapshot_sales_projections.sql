-- snapshot_sales_projections: freeze this month's forecast, permanently.
--
-- Phase E. Writes one row per horizon into public.sales_projection_snapshots
-- from v_sales_projection_ensemble, as it stands at the moment of the call.
--
-- Called monthly by pg_cron -- see
-- supabase/sql_editor/schedule_snapshot_sales_projections_cron.sql, which runs
-- refresh_sales_projection_caches() FIRST in the same job.
--
-- ── WHY IT RETURNS TEXT ─────────────────────────────────────────────────────
--
-- The notification scanners in this folder return void, which is right for
-- them -- they emit their own evidence as notification rows. A monthly job
-- that silently writes to a table and returns nothing tells you nothing when
-- you check on it eleven months later. Modelled on
-- refresh_sales_projection_caches() instead, which returns a run summary for
-- the same reason.
--
-- ── SECURITY DEFINER, AND WHY search_path IS NOT '' ─────────────────────────
--
-- Runs under pg_cron with no calling user session, so it must write on its own
-- authority. search_path is pinned -- a SECURITY DEFINER function with a
-- mutable search_path is a privilege-escalation vector -- but to
-- `public, private, pg_temp` rather than the `''` used elsewhere in this
-- folder. `private` was added 2026-10-15: this function now reads the
-- ensemble CACHE, not the public view, so not everything it touches is in
-- public any more. The names stay fully qualified regardless, which is what
-- actually makes it safe -- the search_path entry just matches
-- refresh_sales_projection_caches().
--
-- ── IDEMPOTENT, DELIBERATELY ────────────────────────────────────────────────
--
-- `on conflict do nothing` against unique (snapshot_month, horizon).
--
-- The conflict action is NOTHING, not an update. If a snapshot for this month
-- already exists, the one already written is the one that was true when it was
-- taken, and overwriting it would quietly revise the historical record this
-- table exists to protect. A second run is a no-op and says so in its return
-- value.
-- ############################################################################

create or replace function public.snapshot_sales_projections()
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
    v_month    date := date_trunc('month', current_date)::date;
    v_inserted int;
    v_existing int;
begin
    -- Called by pg_cron (no JWT, so auth.uid() is null) and by a superadmin
    -- doing a manual first run. Anything else is a call that should not be
    -- happening -- same guard as auto_clock_out(), the only other scheduled
    -- job in this estate that WRITES rather than notifies.
    if auth.uid() is not null and not public.is_superadmin() then
        raise exception
            'snapshot_sales_projections is a scheduled job and cannot be called directly';
    end if;

    select count(*) into v_existing
    from public.sales_projection_snapshots
    where snapshot_month = v_month;

    insert into public.sales_projection_snapshots (
        snapshot_month, period_month, horizon,
        projected, lo_80, hi_80, lo_95, hi_95,
        implied_from_order_book, implied_from_apriori, coverage, order_book_weight,
        model_detail, config
    )
    select
        v_month,
        e.period_month,
        e.horizon,
        e.projected, e.lo_80, e.hi_80, e.lo_95, e.hi_95,
        e.implied_from_order_book, e.implied_from_apriori, e.coverage, e.order_book_weight,
        e.model_detail,
        -- The configuration, DERIVED where it can be rather than asserted.
        --
        -- `weight_rule` compares the weight actually applied against
        -- coverage(h), so the record cannot claim a rule the numbers
        -- contradict. If someone changes the weight and forgets this function,
        -- the snapshot says 'custom' instead of lying.
        jsonb_build_object(
            'weight_rule',
                case when abs(e.order_book_weight - e.coverage) < 1e-9
                     then 'coverage(h)' else 'custom' end,
            'band_origins',          e.band_origins,
            'band_source',
                case when e.band_origins is null
                     then 'composed variance (fallback)'
                     else 'measured quantiles' end,
            'published_horizon_cap', 6,
            'fn_version',            '2026-10-14'
        )
    -- READS THE CACHE (2026-10-15), so what gets frozen each month is
    -- exactly what the dashboard displayed. The monthly cron runs
    -- refresh_sales_projection_caches() immediately before this, and that
    -- function rebuilds the ensemble cache as its final step -- so the row
    -- frozen here is always built from the month that just closed.
    --
    -- ⚠ Do NOT call this out of band without refreshing first. v_month below
    -- is live while e.period_month is cached; on the 1st of a month, before
    -- the 00:20 job, those two disagree and the mismatch would be frozen into
    -- the record permanently.
    from private.mv_sales_projection_ensemble e
    on conflict (snapshot_month, horizon) do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted = 0 then
        return format(
            'no-op -- %s already had %s snapshot rows; existing record left untouched',
            to_char(v_month, 'Mon YYYY'), v_existing
        );
    end if;

    return format(
        'snapshotted %s -- %s rows written (horizons %s), h=1 projected %s',
        to_char(v_month, 'Mon YYYY'),
        v_inserted,
        (select string_agg(horizon::text, ',' order by horizon)
           from public.sales_projection_snapshots where snapshot_month = v_month),
        (select round(projected) from public.sales_projection_snapshots
          where snapshot_month = v_month and horizon = 1)
    );
end;
$$;

-- Belt and braces alongside the in-body guard: take away the default grant so
-- an ordinary session cannot even reach the function.
revoke execute on function public.snapshot_sales_projections() from public;
revoke execute on function public.snapshot_sales_projections() from authenticated;

-- Revoking from PUBLIC removes it from service_role too. pg_cron runs as the
-- function's owner and needs no grant, but service_role is handed it back so
-- the job can also be triggered out-of-band if a month is ever missed.
grant execute on function public.snapshot_sales_projections() to service_role;


comment on function public.snapshot_sales_projections() is
    'Freezes the current month''s forecast into sales_projection_snapshots, '
    'one row per horizon. Idempotent: a second run in the same month is a '
    'no-op, because the snapshot already written is the one that was true '
    'when it was taken. Scheduled monthly AFTER '
    'refresh_sales_projection_caches() -- running it first would freeze last '
    'month''s view of the world and label it this month''s.';


-- ── VERIFY ──────────────────────────────────────────────────────────────────
--
--     select public.snapshot_sales_projections();      -- 12 rows
--     select public.snapshot_sales_projections();      -- no-op, same count
--
--     select horizon, round(projected) as projected, config->>'weight_rule'
--     from public.sales_projection_snapshots
--     where snapshot_month = date_trunc('month', current_date)::date
--     order by horizon;
--
-- `weight_rule` must read 'coverage(h)'. 'custom' means the ensemble view's
-- weight no longer matches coverage and this function's assumptions are stale.
--
-- h=1 `projected` must equal the Next Month tile on Sales Reports exactly. A
-- difference means this function and the tile are reading different objects.
-- Since 2026-10-15 BOTH read private.mv_sales_projection_ensemble, so they
-- agree by construction -- and if they ever stop agreeing, one of them was
-- repointed without the other.
-- ############################################################################

-- ############################################################################
-- v_sales_order_development -- link ratios as they stand TODAY
--
-- Read-only view. Depends on private.mv_sales_order_development_pit.
--
-- ── REWRITTEN 2026-10-14: THIS IS NOW A FILTER, NOT A CALCULATION ───────────
--
-- The arithmetic that used to live here moved to
-- sales_order_development_pit_view.sql, which computes the same rates for
-- EVERY as-of month rather than only for today. This view is now that view,
-- filtered to the current month.
--
-- Why the move: the chain-ladder backtest was using these rates to score PAST
-- months, so testing March 2025 applied rates partly derived from 2026. The
-- model was being shown the answer. The backtest now reads the point-in-time
-- rates; the FORWARD model still reads this one, because "as of today" is
-- exactly right when forecasting forward.
--
-- Why a filter and not a second copy: two implementations of the same
-- calculation agree until one of them is edited. That is the shape of the
-- UNION ALL positional bug from Phase C, which silently made the h=1 blend
-- read 46% below actuals. One calculation, two consumers.
--
-- ── READS THE CACHE ─────────────────────────────────────────────────────────
--
-- private.mv_sales_order_development_pit, not the view behind it. The forward
-- model sits on the live dashboard, and computing ~100 as-of months to use one
-- of them on every page load would be absurd.
--
-- Caching is correct here rather than a shortcut: a rate is computed only from
-- months that have CLOSED (`as_of - 1 month`), so it cannot change part-way
-- through a month. The dashboard's existing `cacheStale` flag covers the one
-- real failure mode -- a month closing with nobody refreshing.
--
-- ── COLUMN LIST IS UNCHANGED ────────────────────────────────────────────────
--
-- Same seven columns in the same order as before this rewrite, so
-- `create or replace` holds and every downstream view keeps working untouched.
-- A2/A3 in the Phase A verification should return exactly what they did.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_order_development_pit_view.sql AND after the materialization
-- file has created the cache -- this view cannot resolve without it.
-- ############################################################################

create or replace view public.v_sales_order_development
with (security_invoker = on) as

select age_months,
       cohorts_used,
       outstanding_myr,
       converted_next_myr,
       link_rate,
       survival_log,
       implied_cumulative
from private.mv_sales_order_development_pit
where as_of_month = date_trunc('month', current_date)::date
order by age_months;


comment on view public.v_sales_order_development is
    'Chain-ladder LINK RATIOS as they stand today: share of still-outstanding '
    'order value that converts to invoice in the following month, by age. '
    'Estimated on survivors and applied to survivors, which cancels the '
    'survivorship bias that made the earlier share-of-original formulation '
    'over-predict by ~60% (verification A6). Since 2026-10-14 this is a FILTER '
    'over v_sales_order_development_pit at the current month -- the arithmetic '
    'lives there, so the forward model and the backtest cannot drift apart. '
    'The backtest reads the point-in-time rates instead.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseA_verification.sql
-- Run them one at a time, after this file has succeeded.
--
-- A2/A3 must return what they returned before this rewrite. If they moved, the
-- filter is selecting the wrong as-of month.

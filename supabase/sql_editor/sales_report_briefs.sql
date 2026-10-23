-- ############################################################################
-- ⚠ PARKED 2026-10-23 -- NOT RUN IN SUPABASE. Kept for the AI Meeting Brief,
-- which is built but not deployed (see src/pages/user/sales/reports/tabs/
-- MeetingBrief.jsx). Expected to become a generic report_briefs table when
-- the brief is made reusable across reports. tests/sql/sales_metrics.test.js
-- still loads it, so its access rules stay tested.
-- ############################################################################
-- sales_report_briefs.sql -- storage for the AI Meeting Brief on Sales
-- Reports' Summary tab (2026-10-23). Plan: docs/sales/SALES-REPORTS-TABS-
-- PLAN.md (final build §5). Written by the edge function
-- supabase/edge_functions/generate-sales-meeting-brief.ts, read by
-- src/features/sales/reports/private/api/fetchMeetingBrief.js.
--
-- WHY A NEW TABLE, not ai_dashboard_summaries (the Leads Overview summary):
-- that table is readable by every signed-in user (policy USING true), has
-- no salesperson column, and is written with the service role key. A brief
-- of the Sales Reports must be exactly as private as the report itself:
--
--   * one brief per (period, salesperson); owner_id null = everyone. A
--     regenerate REPLACES it (upsert on that key) instead of piling up rows
--   * RLS: only someone who may open Sales Reports (can_view_sales_reports,
--     the same rule the report RPCs raise on) can read or write a brief,
--     and only for a salesperson the report would show them --
--     sales_report_scope() forces a staff-role user to their own data, so
--     a staff user can only see/write briefs about themselves
--   * the edge function calls Supabase with the CALLER'S token, so these
--     policies -- and the report RPCs' own guard -- apply to it too. No
--     service role anywhere.
--   * figures: the exact numbers the brief was written from, kept with it,
--     so a reader can check any sentence against its source
--
-- Run after sales_metric_functions.sql (it uses can_view_sales_reports and
-- sales_report_scope). Re-runnable.
-- ############################################################################

create table if not exists public.sales_report_briefs (
    id           uuid primary key default gen_random_uuid(),
    period_start date not null,
    period_end   date not null,
    owner_id     uuid references public.employees (id) on delete cascade,
    -- the unique key needs a non-null stand-in for "everyone"
    owner_key    uuid generated always as
                     (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
    figures      jsonb not null,
    brief_text   text not null,
    model        text,
    created_by   uuid default auth.uid(),
    created_at   timestamptz not null default now(),
    constraint sales_report_briefs_key unique (period_start, period_end, owner_key)
);

alter table public.sales_report_briefs enable row level security;

-- The salesperson a caller may see a brief about: what sales_report_scope
-- resolves owner_id to (staff -> themselves). CASE so the scope function --
-- which raises for anyone outside SAL / MGM -- only runs for those who pass
-- can_view_sales_reports(); everyone else simply sees no rows.
create or replace function public.sales_report_brief_visible(p_owner_id uuid)
returns boolean
language sql
stable
security invoker
as $$
    select case
        when not public.can_view_sales_reports() then false
        else p_owner_id is not distinct from (
            select s.owner_id from public.sales_report_scope(p_owner_id) s)
    end
$$;

drop policy if exists "sales_report_briefs_select" on public.sales_report_briefs;
create policy "sales_report_briefs_select" on public.sales_report_briefs
    for select to authenticated
    using (public.sales_report_brief_visible(owner_id));

drop policy if exists "sales_report_briefs_insert" on public.sales_report_briefs;
create policy "sales_report_briefs_insert" on public.sales_report_briefs
    for insert to authenticated
    with check (public.sales_report_brief_visible(owner_id));

drop policy if exists "sales_report_briefs_update" on public.sales_report_briefs;
create policy "sales_report_briefs_update" on public.sales_report_briefs
    for update to authenticated
    using (public.sales_report_brief_visible(owner_id))
    with check (public.sales_report_brief_visible(owner_id));

-- No delete policy: briefs are replaced, never removed by users.

revoke all on public.sales_report_briefs from anon;
grant select, insert, update on public.sales_report_briefs to authenticated;

revoke execute on function public.sales_report_brief_visible(uuid) from public, anon;
grant execute on function public.sales_report_brief_visible(uuid) to authenticated;

-- RLS for public.reconciliation_results
--
-- Table created by hyrax-data-platform/infrastructure/
-- reconciliation_results_migration.sql. Written only by the SAP pipeline via
-- the service-role key, which bypasses RLS entirely -- so these policies
-- govern READS from the portal, nothing else.
--
-- BOTH policies ship together, deliberately.
--
-- pipeline_run_log was created superadmin-only and the open SELECT policy was
-- added later, in pipeline_run_log_open_view.sql, after a 2026-09 pg_policies
-- audit found the consequence: checkRecentPipelineFailures.js is called by
-- every dashboard's freshness banner from Finance, Operations and Sales
-- viewers, none of whom are superadmin -- so RLS silently returned zero rows
-- and the "Sync issue detected" warning could never fire for the people it
-- existed to warn. Same class of table, same audience; don't repeat it.
--
-- This is pipeline observability, not business data: no row carries a figure,
-- a customer or an amount, only row counts per table. There is nothing here to
-- scope by department, and a data-integrity warning is useful to anyone
-- reading a dashboard built on that data.
--
-- Idempotent: safe to re-run.

alter table public.reconciliation_results enable row level security;

drop policy if exists "All VIEW" on public.reconciliation_results;
create policy "All VIEW" on public.reconciliation_results
for select to authenticated
using (true);

drop policy if exists "Superadmin CRUD" on public.reconciliation_results;
create policy "Superadmin CRUD" on public.reconciliation_results
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);


-- Verify: expect "All VIEW" (SELECT) and "Superadmin CRUD" (ALL).
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'reconciliation_results'
order by policyname;

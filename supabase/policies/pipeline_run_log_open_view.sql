-- Run this once in the Supabase SQL editor.
--
-- Confirmed live via a full pg_policies audit (2026-09): pipeline_run_log's
-- only policy is "Superadmin CRUD" (role_id = 3) -- disabled-for-everyone-
-- else by design per hyrax-data-platform's own migration comment (pipeline
-- observability, not business data, same convention as sap_pipeline_state).
--
-- But sap_pipeline_state itself already has an open "All VIEW" SELECT policy
-- (true, no role/department condition) -- pipeline_run_log was missed when
-- that convention was applied. Impact confirmed: checkRecentPipelineFailures
-- .js (shared by every dashboard's freshness banner) queries
-- pipeline_run_log directly, and is called from Finance
-- (financeMetadataService.js, departments=["FIN"]), Operations
-- (operationsMetadataService.js, departments=["OPS","MGM"]
-- roles=["manager"]), and Sales (salesReportsMetadataService.js /
-- salesOrdersMetadataService.js, departments=["SAL","MGM"]) -- none of
-- those viewers are superadmin, so RLS silently returns zero rows and the
-- "Sync issue detected" banner can never fire for its intended audience.
--
-- Idempotent: safe to re-run.

drop policy if exists "All VIEW" on public.pipeline_run_log;
create policy "All VIEW" on public.pipeline_run_log
for select to authenticated
using (true);

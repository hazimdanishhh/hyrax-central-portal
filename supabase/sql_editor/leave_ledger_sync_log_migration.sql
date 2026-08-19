-- Append-only audit trail for each HR-triggered leave-ledger sync. Separate
-- from hyrax-data-platform's pipeline_run_log (that table is written by
-- unattended service-role pipelines with no human actor and no per-field
-- change breakdown; this one is written by a logged-in HR user through the
-- portal and needs both an actor and a real diff summary).
--
-- Run this once in the Supabase SQL editor.
create table if not exists public.leave_ledger_sync_runs (
    id                    bigint generated always as identity primary key,
    run_at                timestamptz not null default now(),
    uploaded_by           uuid references public.employees(id),
    status                text not null check (status in ('applied', 'blocked_guardrail')),
    incoming_row_count    integer not null,
    current_row_count     integer not null,
    added_count           integer not null default 0,
    unchanged_count       integer not null default 0,
    removed_count         integer not null default 0,
    skipped_count         integer not null default 0,
    guardrail_overridden  boolean not null default false,
    summary               jsonb not null
);

create index if not exists leave_ledger_sync_runs_run_at_idx
    on public.leave_ledger_sync_runs (run_at desc);

-- A structurally-rejected upload never reaches this table at all -- it
-- fails as a raised exception before any row is touched, so there's nothing
-- to log except the exception itself, which the frontend already has via
-- the error response. Deliberate scope decision, not an oversight.

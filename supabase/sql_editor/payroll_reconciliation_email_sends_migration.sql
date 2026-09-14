-- payroll_reconciliation_email_sends: audit trail for
-- queue_payroll_reconciliation_email_rpc.sql -- one row per successful
-- queue call, so PayrollReconciliationSidebar.jsx can show "Last
-- requested: <date> by <HR user>", and so a future bulk "Send to All"
-- feature (deliberately out of scope for this pass) can skip or report
-- employees already queued for a given period without re-deriving that
-- from email_queue/email_log directly (neither of which is scoped to
-- employee_id/period).
create table if not exists public.payroll_reconciliation_email_sends (
    id             bigint generated always as identity primary key,
    employee_id    uuid not null references public.employees(id),
    period_start   date not null,
    period_end     date not null,
    -- Nullable + on delete set null -- this audit row's own history matters
    -- more than the email_queue row it pointed at, same posture email_queue
    -- itself already takes on related_event_id.
    email_queue_id bigint references public.email_queue(id) on delete set null,
    queued_by      uuid references public.employees(id) default public.current_employee_id(),
    queued_at      timestamptz not null default now()
);

create index if not exists payroll_reconciliation_email_sends_lookup_idx
    on public.payroll_reconciliation_email_sends (employee_id, period_start, period_end, queued_at desc);

-- HR/superadmin only -- same scope as get_payroll_period_summary_rpc.sql's
-- own guard (no self/manager tier; this is payroll data, not a personal
-- attendance record). No INSERT/UPDATE/DELETE policy for `authenticated`
-- at all -- the only writer is queue_payroll_reconciliation_email()
-- (SECURITY DEFINER), same "system of record, direct edits would be
-- discarded" reasoning leave_ledger_crud.sql already documents for its own
-- table.
alter table public.payroll_reconciliation_email_sends enable row level security;

create policy "HR can view payroll reconciliation email sends"
on public.payroll_reconciliation_email_sends
for select to authenticated
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    )
);

create policy "Superadmin can view payroll reconciliation email sends"
on public.payroll_reconciliation_email_sends
for select to authenticated
using (public.is_superadmin());

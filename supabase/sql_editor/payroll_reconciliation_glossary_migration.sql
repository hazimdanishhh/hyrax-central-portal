-- payroll_reconciliation_glossary: single source of truth for the 4
-- payroll-reconciliation flag explanations shown BOTH in
-- PayrollReconciliationSidebar.jsx (frontend read) and in
-- queue_payroll_reconciliation_email_rpc.sql's emailed HTML body (server
-- read) -- factored out specifically so the two can never drift out of
-- sync, the same reasoning leave_ledger_types already established for
-- leave-type labels. `code` matches the `category` values
-- get_payroll_reconciliation_rows() emits 1:1 -- absent / leave_conflict /
-- insufficient_half_day / leave_fraction_error -- and the Payroll Export
-- tab's existing daysAbsentCount/leaveAttendanceConflictCount/
-- insufficientHalfDayHoursCount/leaveFractionErrorCount columns map onto
-- the same 4 codes, in the same order, everywhere.
create table if not exists public.payroll_reconciliation_glossary (
    id                    bigint generated always as identity primary key,
    code                  text    not null unique,
    label                 text    not null,
    description           text    not null,
    employee_action_text  text    not null,
    is_active             boolean not null default true,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz default now()
);

-- Non-sensitive lookup data -- open read so no future consumer of this
-- table (frontend or otherwise) gets a silently-null join.
alter table public.payroll_reconciliation_glossary enable row level security;

create policy "Authenticated users can view payroll reconciliation glossary"
on public.payroll_reconciliation_glossary
for select to authenticated
using (true);

-- Superadmin-only write -- pre-wires "HR can edit wording without a code
-- deploy" for later without a second migration. No such editing UI exists
-- yet.
create policy "Superadmin can manage payroll reconciliation glossary"
on public.payroll_reconciliation_glossary
for all to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

insert into public.payroll_reconciliation_glossary
    (code, label, description, employee_action_text) values
('absent',
 'Absent',
 'No attendance (no hardware scan, no app check-in) and no leave was logged for this employee on a working day -- not a weekend, not a public holiday.',
 'Confirm whether this was planned leave that was never logged -- apply for it retroactively -- or confirm it is a genuine unexcused absence before payroll treats the day as unpaid.'),
('leave_conflict',
 'Leave / Attendance Conflict',
 'A full day of leave was recorded for this date, but real attendance also exists on the same day.',
 'Clarify whether the leave should be withdrawn (you actually worked that day) or the leave date needs correcting.'),
('insufficient_half_day',
 'Insufficient Half-Day Hours',
 'A half-day leave was recorded, but attendance for the other, working half of that day totals less than 4 hours.',
 'Account for the working half of the day (a missed clock-in/out is the common cause), or correct the leave application if it should have been a full day.'),
('leave_fraction_error',
 'Leave Data Error',
 'Leave entries for this date sum to more than one full day -- a data-entry error, not an attendance issue.',
 'Flag this date to HR for correction in the leave ledger; do not treat this date as resolved until it is fixed.')
on conflict (code) do nothing;

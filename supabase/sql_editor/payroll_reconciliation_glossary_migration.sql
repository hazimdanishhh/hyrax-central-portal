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

-- `drop policy if exists` before each `create policy`, added 2026-09-23.
-- Without it this file was a ONE-SHOT: the table/insert halves are guarded
-- (`if not exists`, `on conflict do nothing`) but these two were bare
-- CREATEs, so any re-run died at the first one with
-- `42710: policy "..." already exists` -- and because that aborts the whole
-- paste, everything below it silently never ran. That is exactly how the
-- 'absent' reword at the bottom was missed on its first attempt. Same fix
-- applied to leave_ledger_crud.sql for the same reason.
drop policy if exists "Authenticated users can view payroll reconciliation glossary"
    on public.payroll_reconciliation_glossary;
create policy "Authenticated users can view payroll reconciliation glossary"
on public.payroll_reconciliation_glossary
for select to authenticated
using (true);

-- Superadmin-only write -- pre-wires "HR can edit wording without a code
-- deploy" for later without a second migration. No such editing UI exists
-- yet.
drop policy if exists "Superadmin can manage payroll reconciliation glossary"
    on public.payroll_reconciliation_glossary;
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
 'If you did work, report the missing activity for that day. Otherwise tell HR what the day was, so it can be recorded in HR2000 -- as unpaid leave if there is no entitlement left to cover it. The flag clears on the next leave sync once it is there.'),
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

-- REWORD 'absent' (2026-09-23). The insert above is `on conflict do nothing`,
-- so on any database where the row already exists it changes nothing -- this
-- statement is what actually updates the wording.
--
-- The old text ended "...or confirm it is a genuine unexcused absence before
-- payroll treats the day as unpaid", which instructed the employee to do
-- something that no longer exists: absence acknowledgement was removed, and
-- acknowledge_attendance_day now rejects p_category = 'absent'. This text is
-- read by the reconciliation sidebar AND composed into the weekly employee
-- email (queue_payroll_reconciliation_email_rpc.sql), so leaving it would have
-- been the app telling people to click a button that is not there.
update public.payroll_reconciliation_glossary
set employee_action_text =
        'If you did work, report the missing activity for that day. Otherwise '
        'tell HR what the day was, so it can be recorded in HR2000 -- as '
        'unpaid leave if there is no entitlement left to cover it. The flag '
        'clears on the next leave sync once it is there.',
    updated_at = now()
where code = 'absent'
  and employee_action_text like 'Confirm whether this was planned leave%';

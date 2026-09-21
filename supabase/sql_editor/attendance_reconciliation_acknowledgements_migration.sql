-- Acknowledging a reconciliation flag: recording that a flagged day has been
-- reviewed and needs no further action, so it stops being an open item.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 11 -- after
-- payroll_reconciliation_glossary_migration.sql (the `category` FK below) and
-- after attendance_adjustment_reasons_migration.sql (whose shape this mirrors).
--
-- WHY THIS EXISTS
--
-- payroll_reconciliation_glossary already tells the employee, for an absence:
-- "Confirm whether this was planned leave that was never logged -- apply for it
-- retroactively -- or confirm it is a genuine unexcused absence before payroll
-- treats the day as unpaid."
--
-- There was no way to do the second half. The ONLY way to clear an 'Absent'
-- flag was to add attendance -- i.e. to record work that did not happen. So a
-- genuine absence stayed flagged forever, reappearing in every weekly reminder
-- and every payroll export, and the reconciliation list could never reach zero.
--
-- SEMANTICS, confirmed with HR: acknowledging an absence DECLARES THE DAY
-- UNPAID. That is the whole meaning -- there is no paid/unpaid variant, so the
-- reason below is audit/reporting only and carries no payroll switch.
--
-- ACKNOWLEDGING DOES NOT ERASE THE ABSENCE. get_payroll_period_summary's
-- daysAbsentCount deliberately still counts an acknowledged day: the employee
-- was absent and payroll still deducts an unpaid day. What acknowledging closes
-- is the REVIEW, not the FACT. A parallel unacknowledged* count drives the
-- reconciliation UI. Inverting that would silently under-report unpaid days to
-- payroll.
--
-- SCOPE, confirmed with HR: only 'absent' and 'insufficient_half_day'.
-- Deliberately NOT 'leave_conflict' or 'leave_fraction_error' -- both of those
-- resolve themselves once the corrected leave lands in the next HR2000 weekly
-- sync (sync_leave_ledger_from_snapshot), so an acknowledgement would be a
-- second, competing source of truth for something already converging on its own.

-- ---------------------------------------------------------------------------
-- 1. Reason lookup
-- ---------------------------------------------------------------------------
-- A table rather than a CHECK, for the same three reasons
-- attendance_adjustment_reasons documents: the description is shown to the
-- person acknowledging, HR can reword without a deploy, and the reason becomes
-- countable ("how many no-shows this quarter" is a real HR question).
create table if not exists public.attendance_acknowledgement_reasons (
    id             bigint generated always as identity primary key,
    code           text    not null unique,
    label          text    not null,
    description    text    not null,
    -- Which reconciliation categories this reason may be used for. Array
    -- rather than a single FK because 'other' applies to both. Mirrors the
    -- expense_claim_categories.applicable_claim_types shape specified in
    -- docs/finance/EXPENSE-CLAIMS-DESIGN.md.
    applicable_categories text[] not null,
    requires_notes boolean not null default false,
    is_active      boolean not null default true,
    sort_order     integer not null default 0,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz default now()
);

alter table public.attendance_acknowledgement_reasons enable row level security;

drop policy if exists "Authenticated users can view acknowledgement reasons"
    on public.attendance_acknowledgement_reasons;
create policy "Authenticated users can view acknowledgement reasons"
on public.attendance_acknowledgement_reasons
for select to authenticated
using (true);

drop policy if exists "HR can manage acknowledgement reasons"
    on public.attendance_acknowledgement_reasons;
create policy "HR can manage acknowledgement reasons"
on public.attendance_acknowledgement_reasons
for all to authenticated
using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.department_id = 7)
)
with check (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.department_id = 7)
);

drop policy if exists "Superadmin can manage acknowledgement reasons"
    on public.attendance_acknowledgement_reasons;
create policy "Superadmin can manage acknowledgement reasons"
on public.attendance_acknowledgement_reasons
for all to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

-- SEED -- these labels are a PROPOSAL, not confirmed company policy. Same
-- caveat leave_ledger_types.is_paid carries: surfaced at face value, to be
-- confirmed with HR before anyone reports on the breakdown. Reword freely --
-- `code` is the stable identifier, `label` is display-only.
insert into public.attendance_acknowledgement_reasons
    (code, label, description, applicable_categories, requires_notes, sort_order) values
('no_show',
 'Absent Without Notice',
 'The employee did not attend and did not notify anyone in advance.',
 array['absent'], false, 10),
('notified_no_leave',
 'Notified, No Leave Entitlement',
 'The employee gave notice, but had no remaining leave entitlement to cover the day.',
 array['absent'], false, 20),
('sick_no_mc',
 'Sick Without Medical Certificate',
 'The employee reported sick but did not provide an MC, so the day cannot be recorded as sick leave.',
 array['absent'], false, 30),
('unpaid_leave_agreed',
 'Unpaid Leave Agreed',
 'Unpaid time off agreed with the employee in advance.',
 array['absent'], false, 40),
('hours_accepted',
 'Hours Reviewed and Accepted',
 'The recorded hours for the working half of the day were reviewed and are correct as they stand.',
 array['insufficient_half_day'], false, 50),
('other',
 'Other',
 'Any reason not covered above. A written explanation is required so the decision can be reviewed later.',
 array['absent', 'insufficient_half_day'], true, 60)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 2. The acknowledgements themselves
-- ---------------------------------------------------------------------------
-- KEYED ON (employee_id, work_date, category) because that is EXACTLY the grain
-- get_payroll_reconciliation_rows() already emits -- one row per flagged cell.
-- The table mirrors the shape of the thing it silences, so "is this flag
-- resolved" is a single NOT EXISTS with no translation layer.
--
-- `category` FKs payroll_reconciliation_glossary(code) (already unique), so the
-- acknowledgement vocabulary can never drift from the flag vocabulary.
create table if not exists public.attendance_reconciliation_acknowledgements (
    id              bigint generated always as identity primary key,
    employee_id     uuid not null references public.employees(id),
    work_date       date not null,
    category        text not null references public.payroll_reconciliation_glossary(code),
    reason_id       bigint not null references public.attendance_acknowledgement_reasons(id),
    notes           text,
    -- Who closed it, as distinct from whose day it is. For an absence this may
    -- legitimately be the employee themselves (confirming their own absence is
    -- an admission against their own interest, so there is nothing to gain by
    -- it), their manager, or HR.
    acknowledged_by uuid not null references public.employees(id),
    acknowledged_at timestamptz not null default now(),
    unique (employee_id, work_date, category)
);

-- The lookup every suppression point makes: "does an acknowledgement exist for
-- this employee/day/category". Covered exactly by the unique index above, so no
-- second index is needed.

alter table public.attendance_reconciliation_acknowledgements enable row level security;

-- SELECT only. The two RPCs (acknowledge_attendance_day /
-- revoke_attendance_day_acknowledgement) are the sole writers, because the
-- write rule is category-dependent (an employee may close an absence but not an
-- insufficient-half-day) and that is far clearer in one function than split
-- across policies. Same reasoning payroll_reconciliation_email_sends documents
-- for having no client write policy at all.
--
-- The 4 tiers are the established shape from leave_ledger_crud.sql: self,
-- superadmin, HR department (7), and the employee's direct manager.
drop policy if exists "Employees can view their own acknowledgements"
    on public.attendance_reconciliation_acknowledgements;
create policy "Employees can view their own acknowledgements"
on public.attendance_reconciliation_acknowledgements
for select to authenticated
using (employee_id = public.current_employee_id());

drop policy if exists "Superadmin can view all acknowledgements"
    on public.attendance_reconciliation_acknowledgements;
create policy "Superadmin can view all acknowledgements"
on public.attendance_reconciliation_acknowledgements
for select to authenticated
using (public.is_superadmin());

drop policy if exists "HR can view all acknowledgements"
    on public.attendance_reconciliation_acknowledgements;
create policy "HR can view all acknowledgements"
on public.attendance_reconciliation_acknowledgements
for select to authenticated
using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.department_id = 7)
);

drop policy if exists "Managers can view their direct reports acknowledgements"
    on public.attendance_reconciliation_acknowledgements;
create policy "Managers can view their direct reports acknowledgements"
on public.attendance_reconciliation_acknowledgements
for select to authenticated
using (
    exists (
        select 1 from public.employees sub
        where sub.id = attendance_reconciliation_acknowledgements.employee_id
          and sub.manager_id = public.current_employee_id()
    )
);

comment on table public.attendance_reconciliation_acknowledgements is
    'One row per resolved reconciliation flag, keyed on the same '
    '(employee, date, category) grain get_payroll_reconciliation_rows() emits. '
    'For category = absent, the existence of a row DECLARES THE DAY UNPAID. '
    'Acknowledging closes the review, not the fact -- daysAbsentCount still '
    'counts the day for payroll.';

-- Acknowledging a reconciliation flag: recording that a flagged day has been
-- reviewed and needs no further action, so it stops being an open item.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 11 -- after
-- payroll_reconciliation_glossary_migration.sql (the `category` FK below) and
-- after attendance_adjustment_reasons_migration.sql (whose shape this mirrors).
--
-- WHY THIS EXISTS
--
-- A flagged day that cannot be resolved reappears in every weekly reminder and
-- every payroll export forever, and the reconciliation list never reaches
-- zero. Each flag therefore needs a way to close.
--
-- SCOPE AS OF 2026-09-23: 'insufficient_half_day' ONLY.
--
-- Three of the four categories close by CORRECTING THE DATA UPSTREAM, not by
-- acknowledging:
--
--   absent               -> the day is recorded in HR2000 (as NPL if genuinely
--                           unpaid), and the next leave sync turns it into an
--                           `on_leave` day. Or attendance is added, if they
--                           actually worked.
--   leave_conflict       -> corrected leave lands in the next HR2000 sync.
--   leave_fraction_error -> same.
--
-- Acknowledging any of those would be a second, competing source of truth for
-- something already converging on its own -- and worse, it would let someone
-- close the review WITHOUT the record ever reaching the system that actually
-- pays.
--
-- 'insufficient_half_day' is the exception, and the only one left: it has no
-- HR2000 equivalent. The leave fraction and the hours are both already
-- correct, the day just looks short. There is nothing to record upstream, so
-- acknowledging IS the resolution, and its single reason
-- ('Hours Reviewed and Accepted') says exactly that.
--
-- HISTORY. 'absent' was acknowledgeable until 2026-09-23, with the semantics
-- "acknowledging DECLARES THE DAY UNPAID". It was removed once it was
-- confirmed that every unexcused absence ends up in HR2000 as NPL regardless.
-- Nothing about pay changed when it went: acknowledged + unacknowledged always
-- summed to daysAbsentCount, and payroll deducts in HR2000 either way.
-- See section 1b, and acknowledge_attendance_day_rpc.sql's own header.
--
-- ACKNOWLEDGING STILL DOES NOT ERASE THE FLAG'S UNDERLYING FACT.
-- get_payroll_period_summary's totals deliberately still count an acknowledged
-- day. What acknowledging closes is the REVIEW. A parallel unacknowledged*
-- count drives the reconciliation UI. Inverting that would silently
-- under-report to payroll.

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
--
-- The four absent-only reasons are seeded is_active = false as of 2026-09-23.
-- They are kept, not deleted, because reason_id is a FK from
-- attendance_reconciliation_acknowledgements: any historical row must still
-- resolve to a readable reason. See section 1b for why they were retired.
insert into public.attendance_acknowledgement_reasons
    (code, label, description, applicable_categories, requires_notes, sort_order, is_active) values
('no_show',
 'Absent Without Notice',
 'The employee did not attend and did not notify anyone in advance.',
 array['absent'], false, 10, false),
('notified_no_leave',
 'Notified, No Leave Entitlement',
 'The employee gave notice, but had no remaining leave entitlement to cover the day.',
 array['absent'], false, 20, false),
('sick_no_mc',
 'Sick Without Medical Certificate',
 'The employee reported sick but did not provide an MC, so the day cannot be recorded as sick leave.',
 array['absent'], false, 30, false),
('unpaid_leave_agreed',
 'Unpaid Leave Agreed',
 'Unpaid time off agreed with the employee in advance.',
 array['absent'], false, 40, false),
('hours_accepted',
 'Hours Reviewed and Accepted',
 'The recorded hours for the working half of the day were reviewed and are correct as they stand.',
 array['insufficient_half_day'], false, 50, true),
('other',
 'Other',
 'Any reason not covered above. A written explanation is required so the decision can be reviewed later.',
 array['insufficient_half_day'], true, 60, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 1b. RETIRE THE ABSENCE REASONS (2026-09-23)
-- ---------------------------------------------------------------------------
-- The seed above is `on conflict do nothing`, so on any database where these
-- rows already exist it changes nothing -- which is correct for the labels,
-- and useless for this. These two statements are what actually retires them.
--
-- WHY. Absence acknowledgement was removed; acknowledge_attendance_day now
-- rejects p_category = 'absent' outright. Every unexcused absence ends up in
-- HR2000 as an NPL entry, and the weekly leave sync turns that into an
-- `on_leave` day that clears the flag on its own -- so acknowledging here only
-- ever closed the REVIEW without the record reaching the system that actually
-- pays. It never moved a pay figure either (acknowledged + unacknowledged
-- always summed to daysAbsentCount).
--
-- Deactivated rather than deleted: reason_id is a FK, and the RPC's own
-- validation requires `ar.is_active`, so is_active = false is already a hard
-- block on new use.
update public.attendance_acknowledgement_reasons
set is_active = false,
    updated_at = now()
where code in ('no_show', 'notified_no_leave', 'sick_no_mc', 'unpaid_leave_agreed')
  and is_active;

-- 'other' stays active but narrows to the one surviving category. Leaving
-- 'absent' in the array would be harmless today (the RPC rejects the category
-- before it ever reads the reason) but would leave the vocabulary claiming a
-- combination that can no longer exist.
update public.attendance_acknowledgement_reasons
set applicable_categories = array['insufficient_half_day'],
    updated_at = now()
where code = 'other'
  and 'absent' = any(applicable_categories);

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
    -- Who closed it, as distinct from whose day it is. Always HR or a
    -- superadmin now that 'insufficient_half_day' is the only acknowledgeable
    -- category -- waving away a short day is to the employee's advantage, so
    -- it is not theirs to wave. (Rows written before 2026-09-23 may name the
    -- employee or their manager, from when absences were acknowledgeable.)
    acknowledged_by uuid not null references public.employees(id),
    acknowledged_at timestamptz not null default now(),
    unique (employee_id, work_date, category)
);

-- The lookup every suppression point makes: "does an acknowledgement exist for
-- this employee/day/category". Covered exactly by the unique index above, so no
-- second index is needed.

alter table public.attendance_reconciliation_acknowledgements enable row level security;

-- SELECT only. The two RPCs (acknowledge_attendance_day /
-- revoke_attendance_day_acknowledgement) are the sole writers. The rule they
-- enforce is not expressible as a policy: the category must be rejected
-- outright, the day must genuinely still carry the flag, and the reason must
-- be active and valid for that category. Same reasoning
-- payroll_reconciliation_email_sends documents for having no client write
-- policy at all.
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
    'Only category = insufficient_half_day is acknowledgeable as of '
    '2026-09-23; absences resolve by being recorded in HR2000 and re-synced. '
    'Acknowledging closes the review, not the fact -- the period totals still '
    'count the day for payroll.';

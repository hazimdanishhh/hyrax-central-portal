-- attendance_adjustment_reasons: the constrained vocabulary for WHY an
-- attendance record was entered by hand rather than clocked/scanned.
--
-- Run this once in the Supabase SQL editor. This is DEPLOYMENT STEP 1 -- the
-- FK added by attendance_activities_add_entry_method_columns.sql references
-- this table, so it must exist first.
--
-- A lookup table, not a `text check (...)` constraint, deliberately -- this
-- mirrors payroll_reconciliation_glossary_migration.sql's precedent rather
-- than public_holidays.category's. Three reasons that one fits better here:
--
--   1. The description is shown to the person filling the form (as helper
--      text under the reason picker, the same way PayrollReconciliationSidebar
--      renders the glossary's description). A CHECK constraint has nowhere to
--      put that text, so it would end up duplicated in JS and drift.
--   2. HR can add or reword a reason without a code deploy.
--   3. The reason becomes REPORTABLE. "How many device-failure days did we
--      have this cycle" is a real IoT-health signal -- if the Vigilance
--      scanners are failing often enough that HR is reconciling around them
--      every month, that is worth surfacing, and a joinable row makes it a
--      group-by instead of a string scan.
--
-- `code` is the stable identifier anything in SQL/JS should match on; `label`
-- is display-only and safe to reword.
create table if not exists public.attendance_adjustment_reasons (
    id             bigint generated always as identity primary key,
    code           text    not null unique,
    label          text    not null,
    description    text    not null,
    -- Forces a free-text explanation alongside the reason. True only for
    -- 'other', where the code itself carries no information.
    requires_notes boolean not null default false,
    is_active      boolean not null default true,
    -- Display order in the picker, independent of insertion order -- same
    -- reasoning queue_payroll_reconciliation_email_rpc.sql documents for its
    -- own fixed category ordering.
    sort_order     integer not null default 0,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz default now()
);

alter table public.attendance_adjustment_reasons enable row level security;

-- Open read for authenticated -- non-sensitive reference data, same shape as
-- payroll_reconciliation_glossary and project_categories.
--
-- THIS POLICY IS LOAD-BEARING AND MUST EXIST BEFORE attendance_activity_audit
-- is redeployed to join this table. Both attendance views run with
-- security_invoker = on (enable_attendance_views_security_invoker.sql), so a
-- table with RLS enabled and NO select policy silently returns zero rows
-- through them rather than erroring -- adjustment_reason_label would read
-- NULL for every user, with nothing anywhere to indicate why. That is exactly
-- the attendance_logs bug documented in
-- docs/hr/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md ("RLS enabled with zero
-- policies since it was created, so a direct client SELECT always silently
-- returned nothing").
drop policy if exists "Authenticated users can view attendance adjustment reasons"
    on public.attendance_adjustment_reasons;
create policy "Authenticated users can view attendance adjustment reasons"
on public.attendance_adjustment_reasons
for select to authenticated
using (true);

-- Write is HR-or-superadmin -- mirrors public_holidays' own two-policy shape
-- (the closest precedent: HR-maintained reference data feeding attendance),
-- deliberately not the 4-tier self/manager pattern personal data uses.
-- department_id 7 = HR (supabase/csv/departments_rows.csv).
drop policy if exists "HR can manage attendance adjustment reasons"
    on public.attendance_adjustment_reasons;
create policy "HR can manage attendance adjustment reasons"
on public.attendance_adjustment_reasons
for all to authenticated
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    )
)
with check (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    )
);

drop policy if exists "Superadmin can manage attendance adjustment reasons"
    on public.attendance_adjustment_reasons;
create policy "Superadmin can manage attendance adjustment reasons"
on public.attendance_adjustment_reasons
for all to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

-- Seed. `on conflict (code) do nothing` makes this re-runnable, same as the
-- glossary's own seed block.
--
-- The wording is written for the EMPLOYEE, not for HR -- the same audience
-- payroll_reconciliation_glossary.employee_action_text targets, since the
-- self-reconciliation path (My Attendance) shows these to the person whose
-- day it is.
insert into public.attendance_adjustment_reasons
    (code, label, description, requires_notes, sort_order) values
('device_failure',
 'Scanner / Device Failure',
 'The door scanner was down, offline, or failed to register the badge, so no scan exists for a day that was actually worked.',
 false, 10),
('forgot_to_tap',
 'Forgot to Tap',
 'The employee was present but did not badge in or out -- the most common cause of a missing or single-scan day.',
 false, 20),
('missed_clock_out',
 'Missed Clock-Out',
 'A remote app session was started but never closed, so the day has a check-in with no matching check-out.',
 false, 30),
('business_trip',
 'Business Trip',
 'Work performed away from any company site during a local or overseas trip, where no scanner is available at all.',
 false, 40),
('company_event',
 'Company Event',
 'Attendance at a company event held away from a scanner-equipped site (annual dinner, townhall, team building, CSR day).',
 false, 50),
('other',
 'Other',
 'Any reason not covered above. A written explanation is required so the record can be reviewed later.',
 true, 60)
on conflict (code) do nothing;

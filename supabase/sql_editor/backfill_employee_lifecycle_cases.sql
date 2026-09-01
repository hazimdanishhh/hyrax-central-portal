-- Run this ONCE, after every function/trigger/policy file for this module
-- has been deployed and the notification rules have been seeded AND
-- paused (seed_employee_lifecycle_notification_rules.sql,
-- pause_employee_offboarding_scan_rules.sql).
--
-- Both case-creation triggers are INSERT/UPDATE-only -- they only ever
-- fire on a genuinely new row or a genuine change. Anyone already sitting
-- in employees at the moment this feature deploys never gets re-inserted
-- or has the qualifying field re-set, so they'd silently never receive a
-- case. Direct precedent for this exact class of gap:
-- hyrax-data-platform/infrastructure/employee_sales_rep_mapping_migration.sql
-- paired an AFTER INSERT trigger for future rows with a one-time backfill
-- INSERT for pre-existing qualifying rows.
--
-- Calls the get-or-create functions DIRECTLY, not through the
-- notification-emitting trigger wrappers (handle_employee_onboarding_case_open/
-- handle_employee_offboarding_case_open) -- this is exactly why those were
-- split apart from get_or_create_*_case() in the first place: the backfill
-- needs case-creation without notification emission, or every pre-existing
-- mid-flight employee would fire a fresh "just started" notification for
-- work that's actually been in progress for weeks.
--
-- Onboarding backfill uses the IDENTICAL guard the live trigger uses.
select public.get_or_create_onboarding_case(e.id, 'backfill_deploy_2026_09')
from public.employees e
where e.employment_status_id = 3
   or e.join_date >= current_date - interval '30 days';

-- Offboarding backfill is DELIBERATELY NARROWER than the live trigger's
-- three branches -- covers only resignation_date/Terminated-Notice, both
-- inherently "still in progress" facts. Excludes the direct-to-terminated
-- branch on purpose: employees has no employment-status-change timestamp,
-- so a point-in-time scan can't tell "just terminated yesterday" from
-- "terminated three years ago" -- retroactively opening a case for a
-- years-old departure would be exactly the kind of footgun
-- auto_activate_project_on_task_started.sql's own header already argues
-- against for the analogous reverse-transition risk.
select public.get_or_create_offboarding_case(e.id, 'backfill_deploy_2026_09')
from public.employees e
where e.resignation_date is not null
   or e.employment_status_id = 13;

-- Verify: counts should match a manual count(*) run against the same two
-- guard conditions just before this script.
select case_type, count(*)
from public.employee_lifecycle_cases
where opened_reason = 'backfill_deploy_2026_09'
group by case_type;

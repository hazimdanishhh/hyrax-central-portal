-- Run this once in the Supabase SQL editor. Reverses
-- pause_employee_offboarding_scan_rules.sql now that active-employee data
-- has been backfilled and reviewed and HR/IT are about to start UAT --
-- see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's UAT readiness
-- pass. (Past/already-departed employees were deliberately never
-- backfilled -- no case should retroactively open for someone who left
-- before this module existed, so there's nothing further to wait on there.)
--
-- Before running this, it's worth previewing roughly how many
-- notifications the very next cron tick (or a manual invocation of the two
-- scan functions right after) will produce, so the first batch isn't a
-- surprise:
--
--   select count(*) filter (where expected_last_day < current_date) as overdue_now,
--          count(*) filter (where expected_last_day between current_date and current_date + interval '7 days') as approaching_now
--   from public.employee_lifecycle_cases
--   where case_type = 'OFFBOARDING' and status = 'OPEN';
update public.notification_rules
set is_active = true
where event_type in ('employee.offboarding_last_day_approaching', 'employee.offboarding_overdue');

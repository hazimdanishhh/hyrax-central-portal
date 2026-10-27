-- ############################################################################
-- Retire the OLD versions of four page functions (2026-10-27, found by the
-- catalog audit -- docs/portal/DATA-INVENTORY.md, "Bug risk").
--
-- Each of these had a newer version created alongside instead of replacing
-- it (CREATE OR REPLACE with a new parameter makes a SECOND function). Two
-- live versions with default parameters make any call that leaves out the
-- newest parameter fail with PGRST203 "Could not choose the best candidate
-- function" -- the error Leads Overview hit on 2026-10-23.
--
-- The app always passes the newest parameter, so it only ever uses the new
-- versions (checked 2026-10-27):
--   get_finance_dashboard       p_vendor_code       fetchFinanceDashboard.js
--   get_hr_employees_dashboard  p_work_location_id  fetchEmployeesDashboard.js
--   get_hr_reports_dashboard    p_work_location_id  fetchHrReportsDashboard.js
--   get_payroll_period_summary  p_work_location_id  payrollPeriodSummaryService.js
--
-- Dropped by EXACT signature: the new versions stay untouched. No CASCADE.
-- Undo: the old bodies are the same files' git history.
-- ############################################################################

-- STEP 1 -- nothing else in the live database may call the old versions by
-- their exact signature. Must return NO rows. (Calls by name alone resolve
-- to whichever version fits, so they keep working.)
select p.oid::regprocedure as caller
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~*
      'get_finance_dashboard\s*\(\s*text\s*,|get_hr_(employees|reports)_dashboard\s*\(\s*date|get_payroll_period_summary\s*\(\s*date';

-- STEP 2
drop function if exists public.get_finance_dashboard(text, bigint, date, date, boolean, text);
drop function if exists public.get_hr_employees_dashboard(date, date, bigint);
drop function if exists public.get_hr_reports_dashboard(date, date, bigint);
drop function if exists public.get_payroll_period_summary(date, date, bigint, uuid);

-- CHECK -- each name now has exactly one version.
select proname, count(*) as versions
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('get_finance_dashboard', 'get_hr_employees_dashboard',
                  'get_hr_reports_dashboard', 'get_payroll_period_summary')
group by proname;

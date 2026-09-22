-- ############################################################################
-- RLS SCOPING CHECK -- does security_invoker actually SCOPE rows, for a real
-- non-privileged user?
--
-- Read-only. Every block runs inside a transaction that ends in ROLLBACK.
--
-- WHY THIS EXISTS, AND WHY THE OBVIOUS CHECKS DO NOT WORK
--
-- After the Ship 1 rebuild, GATE 1a confirmed `security_invoker = on` is SET on
-- both views. That is the mechanism by which RLS applies, so it is good
-- evidence -- but it is not proof that scoping WORKS. If it were ever lost,
-- both views would fall back to OWNER privileges, RLS on attendance_logs /
-- attendance_activities / leave_ledger_entries / employees / attendance_
-- reconciliation_acknowledgements would stop filtering, and every page would
-- render PERFECTLY with no error anywhere -- just with the whole company's
-- data in it.
--
-- Two checks that look like they test this but DO NOT:
--
--   * Opening My Attendance and seeing only your own rows. That page is
--     self-scoped in the QUERY -- myAttendanceService curries your employee id
--     onto the filter before it ever reaches the view. It shows one person's
--     rows whether RLS works or not.
--
--   * Opening Team Attendance and seeing it empty when you have no direct
--     reports. Empty is the correct answer either way.
--
-- Running any query here as the owner also proves nothing: the SQL editor runs
-- as the table owner, and owners bypass RLS. Hence SET LOCAL ROLE below.
-- ############################################################################


-- ============================================================================
-- STEP 1 -- pick a test subject: a PLAIN employee. Not HR (department_id = 7),
-- not a superadmin, and someone who actually has attendance data.
--
-- You need their profiles.id (the auth uid), which is what auth.uid() returns
-- and what every RLS policy compares against.
-- ============================================================================
SELECT p.id AS auth_uid,
       e.full_name,
       e.employee_id AS company_code,
       e.department_id,
       (SELECT count(*) FROM public.attendance_logs al
        WHERE al.employee_id = e.employee_id) AS scan_rows
FROM public.employees e
JOIN public.profiles p ON p.id = e.profile_id
WHERE e.department_id IS DISTINCT FROM 7          -- not HR
  AND e.manager_id IS NOT NULL                     -- an ordinary report
ORDER BY scan_rows DESC
LIMIT 5;


-- ============================================================================
-- STEP 2 -- THE ACTUAL TEST. Paste an auth_uid from step 1 in BOTH places.
--
-- Impersonates that user: switches to the `authenticated` role and sets the
-- JWT claim that auth.uid() reads. ROLLBACK at the end means nothing persists
-- and no permission change outlives the transaction.
--
-- READ THE RESULT LIKE THIS:
--   distinct_employees = 1      -> RLS IS SCOPING. Correct. This is the pass.
--   distinct_employees = <big>  -> RLS IS BYPASSED. Every employee's attendance
--                                  is readable by every logged-in user. Stop and
--                                  roll back the views immediately.
--   distinct_employees = 0      -> over-restricted; the user sees nothing at all.
--                                  Not a data leak, but a broken page for them.
-- ============================================================================
BEGIN;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"PASTE-AUTH-UID-HERE","role":"authenticated"}';

SELECT
    count(*)                        AS rows_visible,
    count(DISTINCT employee_uuid)   AS distinct_employees,
    min(work_date)                  AS earliest,
    max(work_date)                  AS latest
FROM public.unified_daily_attendance
WHERE work_date >= CURRENT_DATE - 30;

ROLLBACK;


-- ============================================================================
-- STEP 3 -- same check against the day sidebar's view, which was dropped and
-- recreated by the same migration and carries its own inline declaration.
-- ============================================================================
BEGIN;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"PASTE-AUTH-UID-HERE","role":"authenticated"}';

SELECT
    count(*)                        AS rows_visible,
    count(DISTINCT employee_uuid)   AS distinct_employees
FROM public.attendance_activity_audit
WHERE work_date >= CURRENT_DATE - 30;

ROLLBACK;


-- ============================================================================
-- STEP 4 -- optional: a MANAGER should see themselves plus their direct
-- reports, and nobody else. Use a manager's auth uid.
--
-- Expect distinct_employees = (their number of direct reports) + 1.
-- Materially more than that means the manager tier is not scoping either.
-- ============================================================================
BEGIN;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"PASTE-MANAGER-AUTH-UID-HERE","role":"authenticated"}';

SELECT count(DISTINCT employee_uuid) AS distinct_employees_visible
FROM public.unified_daily_attendance
WHERE work_date >= CURRENT_DATE - 30;

ROLLBACK;

-- For comparison -- how many direct reports that manager actually has:
-- SELECT count(*) FROM public.employees
-- WHERE manager_id = (SELECT id FROM public.employees WHERE profile_id = 'PASTE-MANAGER-AUTH-UID-HERE');

CREATE OR REPLACE VIEW public.unified_daily_attendance AS

-- 1. Date Spine: Find all unique dates anyone worked, so we know which days the company was open
WITH active_company_dates AS (
    SELECT DISTINCT DATE(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date 
    FROM public.attendance_logs
    UNION
    SELECT DISTINCT DATE(clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date 
    FROM public.attendance_activities
),

-- 2. Expected Shifts: Cross join active-bucket employees with the dates the
-- company was open. Filtered via employment_status.category (see
-- hyrax-data-platform/infrastructure/employment_status_category_migration.sql)
-- -- the same canonical "active" bucket used by the Employee Overview RPC
-- (Active, Probation, On Leave, Sabbatical). Before this filter existed,
-- every employee who ever worked here (including people terminated years
-- ago) got a row for every date the company was ever open, flagged
-- 'Absent' forever -- pure noise inflating every single day's roster.
expected_shifts AS (
    SELECT
        e.id AS employee_uuid,
        e.profile_id,
        e.employee_id AS company_employee_code,
        e.full_name,
        e.department_id,
        e.position,
        e.manager_id,
        e.employment_status_id,
        d.work_date
    FROM public.employees e
    JOIN public.employment_status es ON es.id = e.employment_status_id AND es.category = 'active'
    CROSS JOIN active_company_dates d
),

-- 3. Hardware Logs (Remains unchanged)
daily_hardware AS (
    SELECT 
        employee_id AS scanner_emp_id,
        DATE(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date,
        MIN(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS hw_check_in,
        MAX(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS hw_check_out,
        COUNT(*) AS total_hw_scans,
        ROUND((EXTRACT(EPOCH FROM (MAX(scanned_at) - MIN(scanned_at))) / 3600)::numeric, 2) AS hw_hours
    FROM public.attendance_logs
    GROUP BY employee_id, DATE(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur')
),

-- 4. App Logs: EXCLUDES REJECTED HOURS & CATCHES PENDING STATUSES
daily_app AS (
    SELECT
        aa.employee_id AS app_emp_uuid,
        DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date,
        
        -- Ignore Rejected timestamps for first_in / last_out calculations
        MIN(CASE WHEN aa.approval_status::text != 'Rejected' THEN aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur' END) AS app_check_in,
        MAX(CASE WHEN aa.approval_status::text != 'Rejected' THEN aa.clocked_out_at AT TIME ZONE 'Asia/Kuala_Lumpur' END) AS app_check_out,
        
        -- Create a string that shows the activity AND its status (e.g., "Site Visit (Rejected)")
        STRING_AGG(at.name || ' (' || aa.approval_status::text || ')', ', ' ORDER BY aa.clocked_in_at) AS daily_activities,
        
        -- Flag logic
        BOOL_OR(aa.clocked_out_at IS NULL AND aa.approval_status::text != 'Rejected') AS has_missing_app_checkout,
        BOOL_AND(aa.approval_status::text = 'Approved') AS all_approved,
        BOOL_OR(aa.approval_status::text = 'Pending') AS has_pending,
        
        -- SUM HOURS: Only add hours if the status is NOT Rejected
        ROUND((SUM(
            CASE 
                WHEN aa.approval_status::text != 'Rejected' THEN EXTRACT(EPOCH FROM (aa.clocked_out_at - aa.clocked_in_at)) 
                ELSE 0 
            END
        ) / 3600)::numeric, 2) AS app_hours
        
    FROM public.attendance_activities aa
    LEFT JOIN public.attendance_types at ON aa.attendance_type_id = at.id
    GROUP BY aa.employee_id, DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur')
),

-- 4b. Leave: one row per employee-date that has ANY leave entries that day
-- (there can be more than one -- confirmed AM/PM half-day splits). Sums
-- day_fraction (useful later for payroll's paid/unpaid day counting) and
-- collapses the type(s) present that day into a label for hr_flag.
daily_leave AS (
    SELECT
        le.employee_id AS leave_emp_uuid,
        le.leave_date AS work_date,
        SUM(le.day_fraction) AS leave_day_fraction_total,
        CASE
            WHEN COUNT(DISTINCT le.leave_type_id) = 1 THEN MAX(lt.code)
            ELSE STRING_AGG(DISTINCT lt.code, '+' ORDER BY lt.code)
        END AS leave_type_codes
    FROM public.leave_ledger_entries le
    JOIN public.leave_ledger_types lt ON lt.id = le.leave_type_id
    GROUP BY le.employee_id, le.leave_date
)

-- 5. Bring it all together onto the Expected Shifts matrix
SELECT 
    u.employee_uuid,
    u.company_employee_code,
    u.full_name,
    p.avatar_url,
    u.position,
    u.employment_status_id,
    u.department_id,
    d.name AS department_name,
    u.manager_id,
    m.full_name AS manager_name,
    u.work_date,
    
    -- Hardware Stats
    h.hw_check_in,
    h.hw_check_out,
    h.total_hw_scans,
    
    -- App Stats
    a.app_check_in,
    a.app_check_out,
    a.daily_activities,

    -- 🕒 TRUE HOURS WORKED (Hardware Hours + NON-REJECTED App Hours)
    COALESCE(h.hw_hours, 0) + COALESCE(a.app_hours, 0) AS hours_worked,

    -- 🚨 HYBRID DISCREPANCY & ABSENCE DETECTION 🚨
    CASE
        -- 1. Absence Catching: No Hardware AND No Valid App Data
        WHEN h.hw_check_in IS NULL AND a.app_check_in IS NULL THEN
            -- Check if the date is a Saturday (6) or Sunday (7). Leave is
            -- checked only inside this "nothing happened today" branch, and
            -- only after the weekend check -- it can only ever replace the
            -- Absent fallback below, never override Approved/Pending/
            -- Missing-Checkout/Incomplete-Scans/OK further down, so it can
            -- only fix a miscategorization, never hide a real anomaly. A
            -- half-day-leave/half-day-worked day still falls through to
            -- whichever work-based branch applies -- is_on_leave/
            -- leave_type_codes/leave_day_fraction below stay populated
            -- regardless, so that context isn't lost even when it's not the
            -- headline hr_flag.
            CASE
                WHEN EXTRACT(ISODOW FROM u.work_date) IN (6, 7) THEN 'Weekend / Rest Day'
                WHEN dl.leave_type_codes IS NOT NULL THEN 'On Leave (' || dl.leave_type_codes || ')'
                ELSE 'Absent'
            END

        -- 2. Master Override: All existing activities are Approved
        WHEN a.all_approved = TRUE
            THEN 'Approved'

        -- 3. Pending Protection: Waiting on HR/Manager to approve remote work
        WHEN a.has_pending = TRUE
            THEN 'Pending App Approval'

        -- 4. App Error: They left a remote session running
        WHEN a.has_missing_app_checkout = TRUE
            THEN 'Missing App Check-Out'

        -- 5. Hardware Error: They only scanned the building once
        WHEN h.total_hw_scans = 1
            THEN 'Incomplete Card Scans'

        -- 6. Perfect Hardware Data (No App data used today, scanned in and out properly)
        ELSE 'OK'
    END AS hr_flag,

    -- Absolute First In (Ignores Rejected App Logs)
    (SELECT MIN(v) FROM (VALUES (a.app_check_in), (h.hw_check_in)) AS t(v)) AS first_in,

    -- Absolute Last Out (Ignores Rejected App Logs)
    (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v)) AS last_out,

    -- Time-of-day only versions of first_in/last_out -- lets the List page
    -- filter "first_in later than 9am" as a plain column comparison
    -- regardless of calendar date (a full timestamptz can't be compared
    -- against a bare time-of-day cutoff via PostgREST). Mirrors the same
    -- 09:00/18:00 thresholds get_attendance_dashboard_rpc.sql already uses
    -- for lateArrivalsCount/earlyLeaveCount, so the List filter and the RPC
    -- KPI can never disagree.
    (SELECT MIN(v) FROM (VALUES (a.app_check_in), (h.hw_check_in)) AS t(v))::time AS first_in_time_of_day,
    (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))::time AS last_out_time_of_day,

    -- HR2000 leave ledger integration -- appended at the end, not inserted
    -- earlier in the list: CREATE OR REPLACE VIEW only allows new columns
    -- to be added after every existing one (Postgres matches view columns
    -- positionally, so inserting mid-list looks like renaming an existing
    -- column and fails with error 42P16). Always populated regardless of
    -- which hr_flag branch fired above -- see HR2000 leave ledger
    -- integration comment on the CASE expression.
    (dl.leave_type_codes IS NOT NULL) AS is_on_leave,
    dl.leave_type_codes,
    dl.leave_day_fraction_total AS leave_day_fraction,

    -- Overtime: time worked strictly after 6PM, regardless of arrival time
    -- -- company policy is NOT "hours_worked > 8". GREATEST/EXTRACT are
    -- null-safe: a day with no checkout (last_out_time_of_day null)
    -- naturally computes to 0 here (GREATEST ignores NULL args), matching
    -- how such days are already excluded downstream via hr_flag/is_on_leave
    -- filters rather than needing a separate null-guard. Repeats the same
    -- MAX(...) expression last_out/last_out_time_of_day above already use
    -- -- a SELECT list can't reference a sibling output column's alias, and
    -- restructuring this view into a wrapping CTE is a bigger change than
    -- this fix warrants.
    GREATEST(
        EXTRACT(EPOCH FROM (
            (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))::time - TIME '18:00:00'
        )) / 3600.0,
        0
    ) AS overtime_hours,

    -- Early leave: before 5PM, flat company-wide for now. Deliberately
    -- COALESCE-guarded (not a bare boolean expression) so a future
    -- per-work-location threshold (see docs/WORK-LOCATIONS-ARCHITECTURE.md)
    -- only needs its TIME '17:00:00' literal swapped for a joined
    -- work_locations.early_leave_time column -- this column's shape/name
    -- doesn't need to change when that lands.
    COALESCE(
        (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))::time < TIME '17:00:00',
        false
    ) AS is_early_leave

FROM expected_shifts u
LEFT JOIN daily_hardware h ON u.company_employee_code = h.scanner_emp_id AND u.work_date = h.work_date
LEFT JOIN daily_app a ON u.employee_uuid = a.app_emp_uuid AND u.work_date = a.work_date
LEFT JOIN daily_leave dl ON u.employee_uuid = dl.leave_emp_uuid AND u.work_date = dl.work_date
LEFT JOIN public.departments d ON u.department_id = d.id
LEFT JOIN public.employees m ON u.manager_id = m.id
LEFT JOIN public.profiles p ON u.profile_id = p.id;
CREATE OR REPLACE VIEW public.unified_daily_attendance AS

-- 1. Date Spine: Find all unique dates anyone worked, so we know which days the company was open
WITH active_company_dates AS (
    SELECT DISTINCT DATE(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date 
    FROM public.attendance_logs
    UNION
    SELECT DISTINCT DATE(clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date 
    FROM public.attendance_activities
),

-- 2. Expected Shifts: Cross join all active employees with the dates the company was open
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
    CROSS JOIN active_company_dates d
    -- Optional: Only include employees who are currently 'Active' in the company
    -- WHERE e.employment_status_id = 'YOUR_ACTIVE_STATUS_ID' 
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
            -- Check if the date is a Saturday (6) or Sunday (7)
            CASE 
                WHEN EXTRACT(ISODOW FROM u.work_date) IN (6, 7) THEN 'Weekend / Rest Day'
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
    (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v)) AS last_out

FROM expected_shifts u
LEFT JOIN daily_hardware h ON u.company_employee_code = h.scanner_emp_id AND u.work_date = h.work_date
LEFT JOIN daily_app a ON u.employee_uuid = a.app_emp_uuid AND u.work_date = a.work_date
LEFT JOIN public.departments d ON u.department_id = d.id
LEFT JOIN public.employees m ON u.manager_id = m.id
LEFT JOIN public.profiles p ON u.profile_id = p.id;
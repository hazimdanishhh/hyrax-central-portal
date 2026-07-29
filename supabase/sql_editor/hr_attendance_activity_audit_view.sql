CREATE OR REPLACE VIEW public.attendance_activity_audit AS

-- 1. Grab all App Activities (Remote/Meetings)
WITH app_events AS (
    SELECT
        aa.id::text AS activity_id, -- Cast to text so it matches the UNION
        aa.employee_id AS employee_uuid,
        e.employee_id AS company_employee_code,
        e.full_name,
        DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date,
        'App' AS event_source,
        at.name AS attendance_type,
        aa.clocked_in_at AS check_in_time,
        aa.clocked_out_at AS check_out_time,
        aa.approval_status::text,
        
        -- 🚨 Micro-Flag for App
        CASE 
            WHEN aa.clocked_out_at IS NULL THEN 'Missing Check-Out' 
            ELSE 'Valid' 
        END AS activity_audit_flag
        
    FROM public.attendance_activities aa
    JOIN public.employees e ON aa.employee_id = e.id
    LEFT JOIN public.attendance_types at ON aa.attendance_type_id = at.id
),

-- 2. Grab all Hardware Sessions (Office/Plant)
hw_events AS (
    SELECT
        -- Generate a unique string ID for React rendering since HW logs don't have a single UUID block
        md5(e.id::text || COALESCE(h.scanner_location, 'HW') || DATE(h.scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur')::text) AS activity_id,
        e.id AS employee_uuid,
        h.employee_id AS company_employee_code,
        e.full_name,
        DATE(h.scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date,
        'Hardware' AS event_source,
        COALESCE(h.scanner_location, 'On-Site') AS attendance_type,
        
        MIN(h.scanned_at) AS check_in_time,
        -- If they only scanned once, MAX and MIN are the same. NULLIF turns it into a NULL check-out!
        NULLIF(MAX(h.scanned_at), MIN(h.scanned_at)) AS check_out_time, 
        
        'System Verified' AS approval_status, -- Hardware doesn't need HR approval
        
        -- 🚨 Micro-Flag for Hardware
        CASE 
            WHEN COUNT(*) = 1 THEN 'Incomplete Scans' 
            ELSE 'Valid' 
        END AS activity_audit_flag
        
    FROM public.attendance_logs h
    JOIN public.employees e ON h.employee_id = e.employee_id
    GROUP BY e.id, h.employee_id, e.full_name, h.scanner_location, DATE(h.scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur')
)

-- 3. Stack them together and order chronologically
SELECT * FROM app_events
UNION ALL
SELECT * FROM hw_events;
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
        END AS activity_audit_flag,

        -- HR2000 leave ledger integration -- NULL here, only leave_events
        -- below ever populates these two. Present on every branch so the
        -- three UNION ALL column lists line up positionally.
        NULL::numeric AS day_fraction,
        NULL::text AS remarks

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
        END AS activity_audit_flag,

        NULL::numeric AS day_fraction,
        NULL::text AS remarks

    FROM public.attendance_logs h
    JOIN public.employees e ON h.employee_id = e.employee_id
    GROUP BY e.id, h.employee_id, e.full_name, h.scanner_location, DATE(h.scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur')
),

-- 3. HR2000 leave ledger integration -- one row per leave_ledger_entries
-- row (not one per day: a genuine AM/PM half-day split is two real rows
-- and must render as two timeline cards, each with its own day_fraction).
-- This is what makes an "On Leave" day finally show up in the Activity
-- Timeline sidebar instead of rendering as an empty "No app activities
-- logged for this day" -- previously this view only ever unioned
-- app_events/hw_events, so fetchEmployeeDayDetails had no leave row to
-- return no matter what leave_ledger_entries said.
leave_events AS (
    SELECT
        'leave-' || le.id::text AS activity_id,
        le.employee_id AS employee_uuid,
        e.employee_id AS company_employee_code,
        e.full_name,
        le.leave_date AS work_date,
        'Leave' AS event_source,

        -- Matches the exact "On Leave (<code>)" shape AttendanceType.jsx's
        -- existing type.startsWith("on leave") branch already special-cases
        -- (originally added for unified_daily_attendance.hr_flag /
        -- employees_public.current_status) -- reusing it here means zero
        -- frontend changes are needed to get the right icon/purple color.
        'On Leave (' || lt.code || ')' AS attendance_type,

        NULL::timestamptz AS check_in_time,
        NULL::timestamptz AS check_out_time,

        -- HR2000's export contains only currently-approved leave (no status
        -- column exists upstream) -- 'Approved' reflects that, not a guess.
        'Approved' AS approval_status,

        -- Must be non-null: AttendanceTimelineCard.jsx calls
        -- .includes("Valid") on this field unconditionally.
        'On Leave' AS activity_audit_flag,

        le.day_fraction,
        le.remarks

    FROM public.leave_ledger_entries le
    JOIN public.leave_ledger_types lt ON lt.id = le.leave_type_id
    JOIN public.employees e ON e.id = le.employee_id
),

-- 4. Public holidays / company off-days -- one synthetic row per employee
-- per holiday that applies to their work_location_id (or a company-wide,
-- work_location_id IS NULL, holiday), mirroring leave_events exactly so a
-- holiday day's Activity Timeline shows a real card instead of "No app
-- activities logged for this day." DISTINCT ON guards the same rare
-- both-a-specific-and-a-NULL-row case hr_unified_daily_attendance_view.sql's
-- daily_holiday CTE already guards against.
holiday_events AS (
    SELECT DISTINCT ON (e.id, ph.holiday_date)
        'holiday-' || ph.id::text AS activity_id,
        e.id AS employee_uuid,
        e.employee_id AS company_employee_code,
        e.full_name,
        ph.holiday_date AS work_date,
        'Holiday' AS event_source,

        -- Matches the exact "On Leave (<code>)" shape AttendanceType.jsx's
        -- existing type.startsWith("on leave") branch special-cases --
        -- given a matching startsWith("public holiday") branch (added in
        -- the same pass), this needs zero new styling work either.
        'Public Holiday (' || ph.name || ')' AS attendance_type,

        NULL::timestamptz AS check_in_time,
        NULL::timestamptz AS check_out_time,
        'Approved' AS approval_status,

        -- Must be non-null: AttendanceTimelineCard.jsx calls .includes(...)
        -- on this field for the App/Hardware branch, though the Holiday
        -- branch (mirroring Leave) doesn't render it at all.
        'Public Holiday' AS activity_audit_flag,

        NULL::numeric AS day_fraction,
        NULL::text AS remarks

    FROM public.public_holidays ph
    JOIN public.employees e
        ON ph.work_location_id = e.work_location_id OR ph.work_location_id IS NULL
    ORDER BY e.id, ph.holiday_date, ph.work_location_id NULLS LAST
),

-- 5. Stack them together
all_events AS (
    SELECT * FROM app_events
    UNION ALL
    SELECT * FROM hw_events
    UNION ALL
    SELECT * FROM leave_events
    UNION ALL
    SELECT * FROM holiday_events
)

-- 6. Annotate every row with unified_daily_attendance's day-level leave/
-- attendance conflict flags -- a single event row can't compute these
-- itself (they're day-wide aggregates: total hours worked, summed leave
-- fraction across possibly several entries), so this reuses that view's
-- single source of truth instead of duplicating the hours_worked/leave-sum
-- logic a second time here. Callers only ever query this view scoped to
-- one employee + one day (fetchEmployeeDayDetails), so the join stays
-- cheap. Frontend only surfaces these on the Leave row
-- (AttendanceTimelineCard.jsx) -- App/Hardware rows carry them too since
-- they're the same day-level fact, just unused there.
SELECT
    ae.*,
    uda.is_leave_attendance_conflict,
    uda.is_insufficient_half_day_hours,
    uda.has_leave_fraction_error,
    uda.is_worked_on_holiday,
    uda.holiday_hours_worked
FROM all_events ae
LEFT JOIN public.unified_daily_attendance uda
    ON uda.employee_uuid = ae.employee_uuid AND uda.work_date = ae.work_date;
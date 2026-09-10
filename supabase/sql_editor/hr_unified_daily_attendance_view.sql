CREATE OR REPLACE VIEW public.unified_daily_attendance AS

-- 1. Date Spine: Find all unique dates anyone worked, so we know which days the company was open
WITH active_company_dates AS (
    -- Company-activity dates resolved via a SECURITY DEFINER helper (not a
    -- plain SELECT against attendance_logs/attendance_activities) so this
    -- spine doesn't silently shrink to "only dates I personally have a row
    -- for" once these tables' RLS actually applies (security_invoker = on
    -- -- see get_company_activity_dates.sql). It only ever reveals "some
    -- date had activity somewhere," never whose.
    SELECT work_date FROM public.get_company_activity_dates()
    -- Public holidays integration -- without this, a date with truly ZERO
    -- scans/clock-ins ANYWHERE in the company (the common case on a major
    -- holiday like Christmas, when nobody is on-call) would never enter
    -- this spine at all, and so would never get a row for ANY employee --
    -- silently hiding the "Public Holiday" hr_flag exactly when it matters
    -- most.
    UNION
    SELECT DISTINCT holiday_date AS work_date
    FROM public.public_holidays
    -- Weekend calendar dates -- same reasoning as public holidays above:
    -- without this, a Saturday/Sunday with zero company-wide activity never
    -- enters the spine, so is_weekend (below) would never even get a row to
    -- appear on for anyone. Bounded to 2 years back / 1 year forward rather
    -- than full company history to keep this cheap -- comfortably covers a
    -- full-year report plus its year-over-year previous-period comparison
    -- (get_attendance_dashboard_rpc.sql's prev_period_rows) without
    -- unconditionally generating years of synthetic weekend rows nobody
    -- asked for. Widen the window if a report ever needs an older weekend
    -- that predates it. Reduced from 3 years back after this exact spine
    -- addition was found to be the fixed per-call cost floor behind a real
    -- statement-timeout regression (see daily_holiday's own comment on the
    -- expected_shifts double-reference this was paired with fixing).
    UNION
    SELECT gs::date AS work_date
    FROM generate_series(
        (SELECT GREATEST(MIN(join_date), CURRENT_DATE - INTERVAL '2 years') FROM public.employees),
        CURRENT_DATE + INTERVAL '1 year',
        INTERVAL '1 day'
    ) AS gs
    WHERE EXTRACT(ISODOW FROM gs) IN (6, 7)
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
        e.work_location_id,
        d.work_date,
        -- A pure calendar fact (Sat/Sun), computed once here regardless of
        -- whether any activity happened that day -- unlike hr_flag below,
        -- this never changes based on what the employee actually did.
        -- Replaces the old 'Weekend / Rest Day' hr_flag branch entirely.
        (EXTRACT(ISODOW FROM d.work_date) IN (6, 7)) AS is_weekend
    FROM public.employees e
    JOIN public.employment_status es ON es.id = e.employment_status_id AND es.category = 'active'
    CROSS JOIN active_company_dates d
),

-- 3. Hardware Logs. hw_hours is a naive first-scan-to-last-scan span --
-- correct for a simple one-visit day, but on its own it silently counts any
-- away-gap (a remote stint via the app, even just a long lunch) as if it
-- were on-site time. daily_hw_remote_overlap below corrects for the part of
-- that gap that a real, separately-tracked remote session already accounts
-- for, so hours_worked (in the final SELECT) doesn't double-count it.
-- hw_check_in_ts/hw_check_out_ts are the raw (non-localized) bounds, kept
-- only for that overlap math -- comparing against attendance_activities'
-- own timestamptz columns needs the real instant, not the display-oriented
-- localized hw_check_in/hw_check_out above.
daily_hardware AS (
    SELECT
        employee_id AS scanner_emp_id,
        DATE(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date,
        MIN(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS hw_check_in,
        MAX(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS hw_check_out,
        COUNT(*) AS total_hw_scans,
        ROUND((EXTRACT(EPOCH FROM (MAX(scanned_at) - MIN(scanned_at))) / 3600)::numeric, 2) AS hw_hours,
        MIN(scanned_at) AS hw_check_in_ts,
        MAX(scanned_at) AS hw_check_out_ts
    FROM public.attendance_logs
    GROUP BY employee_id, DATE(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur')
),

-- 3b. How much of each day's naive hardware span is actually accounted for
-- by a real, separately-tracked remote session rather than genuine on-site
-- presence -- subtracted from hw_hours in the final SELECT so an
-- office-remote-office (or office-remote-blending-plant, etc. -- this is
-- location-agnostic, since daily_hardware above already merges every
-- scanner location into one combined span) day doesn't double-count the
-- remote middle segment. Deliberately NOT solved by pairing individual
-- scans into in/out sessions by position (rejected -- employees routinely
-- forget to scan in or out, which would shift every later pairing that day
-- and produce worse errors than this bug); this only needs each day's outer
-- scan bounds, which stay valid no matter how many intermediate scans were
-- missed or extra. Mirrors daily_app's own existing "ignore a still-open
-- session" treatment (no COALESCE-to-now()) -- an incomplete row already
-- contributes nothing to app_hours below, so it shouldn't contribute a
-- spurious overlap here either. Does NOT attempt to account for a travel/
-- absence gap with no corroborating attendance_activities row at all (e.g.
-- a pure lunch break, or physically moving between two on-site locations
-- with nothing logged in between) -- that remains counted as on-site time,
-- unchanged from prior behavior, and is only fixable with a real per-scan
-- in/out type, not a calculation change.
daily_hw_remote_overlap AS (
    SELECT
        e.id AS app_emp_uuid,
        DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date,
        SUM(
            CASE
                WHEN aa.clocked_out_at IS NOT NULL THEN
                    GREATEST(0, EXTRACT(EPOCH FROM (
                        LEAST(aa.clocked_out_at, h.hw_check_out_ts)
                        - GREATEST(aa.clocked_in_at, h.hw_check_in_ts)
                    )))
                ELSE 0
            END
        ) / 3600 AS overlap_hours
    FROM public.attendance_activities aa
    JOIN public.employees e ON e.id = aa.employee_id
    JOIN daily_hardware h
        ON h.scanner_emp_id = e.employee_id
       AND h.work_date = DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur')
    WHERE aa.approval_status::text != 'Rejected'
    GROUP BY e.id, DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur')
),

-- 4. App Logs: EXCLUDES REJECTED HOURS & CATCHES PENDING STATUSES
daily_app AS (
    SELECT
        aa.employee_id AS app_emp_uuid,
        DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur') AS work_date,
        
        -- Ignore Rejected timestamps for first_in / last_out calculations.
        -- app_check_out falls back to clocked_in_at when a session is still
        -- open (clocked_out_at is null) -- mirrors employees_public.
        -- current_status's own app.latest_event_time fallback for the same
        -- concept, so an ongoing remote session still counts as "last seen"
        -- instead of contributing nothing to last_out below.
        MIN(CASE WHEN aa.approval_status::text != 'Rejected' THEN aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur' END) AS app_check_in,
        MAX(CASE WHEN aa.approval_status::text != 'Rejected' THEN COALESCE(aa.clocked_out_at, aa.clocked_in_at) AT TIME ZONE 'Asia/Kuala_Lumpur' END) AS app_check_out,
        
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
        END AS leave_type_codes,
        -- Paid vs. unpaid split, for payroll prep -- CAVEAT: lt.is_paid is
        -- an unconfirmed guess for nearly every leave type today
        -- (leave_ledger_types.needs_hr_confirmation), pending real HR/
        -- payroll sign-off (see hyrax-data-platform's
        -- leave_ledger_migration.sql). Surfaced at face value, not flagged
        -- in the UI, per the user's explicit decision -- same "disclose in
        -- code comments only" treatment this view already gives
        -- is_late_arrival's 09:00 threshold assumption.
        SUM(le.day_fraction) FILTER (WHERE lt.is_paid) AS paid_leave_day_fraction,
        SUM(le.day_fraction) FILTER (WHERE NOT lt.is_paid) AS unpaid_leave_day_fraction
    FROM public.leave_ledger_entries le
    JOIN public.leave_ledger_types lt ON lt.id = le.leave_type_id
    GROUP BY le.employee_id, le.leave_date
),

-- 4c. Public holidays / company off-days -- resolves at most ONE holiday
-- per employee-day, preferring a holiday scoped to that employee's own
-- work_location_id over a company-wide (work_location_id IS NULL) one on
-- the same date, in the rare case both exist. DISTINCT ON is needed (not
-- just a plain LEFT JOIN) because the OR condition below can otherwise
-- match two public_holidays rows for the same employee-day (a
-- location-specific row AND a company-wide row), which would silently
-- duplicate that employee's row in the final SELECT -- this view's whole
-- contract is one row per employee per day.
--
-- Deliberately joins public.employees directly, NOT expected_shifts --
-- this only ever needs employee_uuid/work_location_id (both already on
-- employees) and public_holidays' own dates, never the full date spine.
-- Critical performance reason, not just avoiding an unnecessary join:
-- expected_shifts was previously referenced twice in this view (here, and
-- again in the final FROM below) -- Postgres's default behavior for a
-- non-recursive CTE referenced more than once is to materialize it in
-- full, UNFILTERED by any caller's date range, before any outer WHERE
-- work_date filter (from get_attendance_dashboard_rpc.sql's period_rows)
-- can reach it. That forced every single query against this view --
-- regardless of how narrow the requested date range was -- to pay the
-- full cost of cross-joining every active employee against the ENTIRE
-- multi-year date spine (a real bug this caused: full-year queries timing
-- out, and even 3-month queries measurably slower than before the weekend
-- date-generation was added to the spine). Reducing expected_shifts to a
-- single reference (only in the final FROM) makes it eligible for
-- inlining instead, so the caller's date filter can finally reach all the
-- way back into the cross join and prune it before the expensive
-- downstream joins (daily_hardware/daily_app/etc.) ever see the rows.
daily_holiday AS (
    SELECT DISTINCT ON (e.id, ph.holiday_date)
        e.id AS holiday_emp_uuid,
        ph.holiday_date AS work_date,
        ph.name AS holiday_name
    FROM public.employees e
    JOIN public.employment_status es ON es.id = e.employment_status_id AND es.category = 'active'
    JOIN public.public_holidays ph
        ON (ph.work_location_id = e.work_location_id OR ph.work_location_id IS NULL)
    ORDER BY e.id, ph.holiday_date, ph.work_location_id NULLS LAST
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

    -- 🕒 TRUE HOURS WORKED (Hardware Hours, minus whatever a known remote
    -- session already accounts for so it isn't double-counted, + NON-
    -- REJECTED App Hours). See daily_hw_remote_overlap above.
    GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) AS hours_worked,

    -- 🚨 HYBRID DISCREPANCY & ABSENCE DETECTION 🚨
    CASE
        -- 1. Absence Catching: No Hardware AND No Valid App Data
        WHEN h.hw_check_in IS NULL AND a.app_check_in IS NULL THEN
            -- Weekend/rest-day is intentionally NOT a branch here anymore --
            -- it's the independent, always-on is_weekend column instead
            -- (see expected_shifts above), so it stays visible even on a
            -- day someone actually worked, which the old hr_flag-only
            -- encoding could never do (working a Saturday made the
            -- 'Weekend / Rest Day' label disappear entirely). This means a
            -- genuine rest day with zero activity now literally reads
            -- hr_flag = 'Absent' here -- correct per the decision that
            -- status should only reflect real attendance outcomes, but the
            -- frontend MUST override the displayed badge to "Weekend" (not
            -- red "Absent") whenever is_weekend is true, or every
            -- Saturday/Sunday looks like an unexcused absence in the UI.
            -- Leave is still checked inside this "nothing happened today"
            -- branch -- it can only ever replace the Absent fallback below,
            -- never override Approved/Pending/Missing-Checkout/Incomplete-
            -- Scans/OK further down, so it can only fix a
            -- miscategorization, never hide a real anomaly. A
            -- half-day-leave/half-day-worked day still falls through to
            -- whichever work-based branch applies -- is_on_leave/
            -- leave_type_codes/leave_day_fraction below stay populated
            -- regardless, so that context isn't lost even when it's not the
            -- headline hr_flag.
            CASE
                WHEN dh.holiday_name IS NOT NULL THEN 'Public Holiday (' || dh.holiday_name || ')'
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
    -- -- company policy is NOT "hours_worked > 8". The overtime window's
    -- start is bounded to the LATER of (actual first arrival, 6PM) -- fixes
    -- a real bug where someone whose entire day started after 6PM (e.g.
    -- clocked in 9PM, out 11PM) previously showed 5h of overtime (11PM
    -- minus a flat 6PM) instead of the real 2h, since the old formula
    -- assumed continuous presence from 6PM regardless of when they actually
    -- arrived. GREATEST/EXTRACT are null-safe: GREATEST ignores NULL
    -- arguments rather than propagating them, so a day with no checkin at
    -- all still computes to 0 here exactly as before (matching how such
    -- days are already excluded downstream via hr_flag/is_on_leave filters
    -- rather than needing a separate null-guard), and a normal day (arrival
    -- before 6PM) is unaffected since GREATEST(early_arrival, 18:00) still
    -- picks 18:00. Repeats the same MAX(...)/MIN(...) expressions
    -- last_out/first_in_time_of_day above already use -- a SELECT list
    -- can't reference a sibling output column's alias, and restructuring
    -- this view into a wrapping CTE is a bigger change than this fix
    -- warrants.
    GREATEST(
        EXTRACT(EPOCH FROM (
            (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))::time
            - GREATEST(
                (SELECT MIN(v) FROM (VALUES (a.app_check_in), (h.hw_check_in)) AS t(v))::time,
                TIME '18:00:00'
              )
        )) / 3600.0,
        0
    ) AS overtime_hours,

    -- Early leave: before this employee's assigned work location's cutoff
    -- (work_locations.early_leave_time), falling back to the flat 5PM
    -- default for employees not yet assigned one -- see
    -- docs/WORK-LOCATIONS-ARCHITECTURE.md. This COALESCE is the exact seam
    -- the prior pass's design left for this change: only the threshold
    -- expression changed, the column's shape/name/callers didn't.
    --
    -- NOT is_weekend / holiday guard: a day nobody was expected to work has
    -- no meaningful "leaving early" concept, regardless of what time real
    -- attendance happened to end -- without this, someone voluntarily
    -- working a Saturday (or a public holiday) who leaves at 4pm would get
    -- flagged exactly like a weekday early-leave violation.
    COALESCE(
        NOT u.is_weekend AND dh.holiday_name IS NULL
        AND (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))::time < COALESCE(wl.early_leave_time, TIME '17:00:00'),
        false
    ) AS is_early_leave,

    -- Work location -- appended at the end, per this view's own
    -- append-only constraint. Drives the "Work Location" filter on
    -- Attendance List/Overview/Reports/Team Attendance.
    u.work_location_id,
    wl.name AS work_location_name,

    -- Late arrival -- mirrors is_early_leave's exact shape/threshold
    -- convention. ASSUMPTION, not a real company policy (same caveat
    -- get_attendance_dashboard_rpc.sql's now-removed v_late_threshold_time
    -- used to carry): no shift/schedule table exists anywhere in this
    -- schema (no expected start time per employee/department), so "late"
    -- has no real threshold to compute against -- fixed at 09:00
    -- company-wide until real shift data exists, revisit then. 09:00 was
    -- previously duplicated as a literal in that RPC and in
    -- attendanceOverviewService.js's applyAttendanceFilter "lateArrival"
    -- case -- both now read this column instead, so the two can never
    -- silently disagree. Repeats first_in_time_of_day's own expression
    -- rather than referencing that alias -- a SELECT list can't reference
    -- a sibling output column's alias (same constraint overtime_hours'
    -- own comment above already documents for last_out_time_of_day).
    -- Appended last, per this view's own append-only constraint (CREATE OR
    -- REPLACE VIEW only allows new columns after every existing one).
    --
    -- NOT is_weekend / holiday guard: same reasoning as is_early_leave
    -- above -- "late" has no meaning on a day nobody was expected to work.
    COALESCE(
        NOT u.is_weekend AND dh.holiday_name IS NULL
        AND (SELECT MIN(v) FROM (VALUES (a.app_check_in), (h.hw_check_in)) AS t(v))::time > TIME '09:00:00',
        false
    ) AS is_late_arrival,

    -- HR2000 leave/attendance conflict detection -- three ways
    -- leave_ledger_entries and real attendance activity can disagree for the
    -- same employee/day. All three are populated regardless of which
    -- hr_flag branch fired above, same precedent is_on_leave/
    -- leave_type_codes/leave_day_fraction already established -- the
    -- conflict is itself the finding, so it shouldn't be hidden behind
    -- whichever work-based hr_flag branch happened to fire.

    -- 1. A FULL day's leave was recorded (one 1.0 entry, or two summed 0.5
    -- entries), yet real attendance exists that day -- either the leave
    -- should not have been approved/should be revoked, or it was entered
    -- against the wrong date in HR2000.
    COALESCE(
        dl.leave_day_fraction_total >= 1
        AND (h.hw_check_in IS NOT NULL OR a.app_check_in IS NOT NULL),
        false
    ) AS is_leave_attendance_conflict,

    -- 2. A HALF day's leave was recorded, but the other (working) half
    -- wasn't adequately covered -- less than 4 hours (half of the
    -- company's implicit 8-hour day) worked. Catches both a partial-but-
    -- short attendance AND a half-day leave with no attendance logged at
    -- all that day (hours_worked computes to 0, which is < 4). Repeats
    -- hours_worked's own expression rather than referencing that alias --
    -- a SELECT list can't reference a sibling output column's alias (same
    -- constraint overtime_hours/is_late_arrival's own comments already
    -- document).
    COALESCE(
        dl.leave_day_fraction_total = 0.5
        AND GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) < 4,
        false
    ) AS is_insufficient_half_day_hours,

    -- 3. HR2000 data-integrity error: this employee/day's leave entries sum
    -- to MORE than one full day (e.g. a duplicate entry, or a half-day and
    -- a full-day both logged against the same date) -- physically
    -- impossible, always a data entry mistake worth a review, regardless
    -- of attendance.
    COALESCE(dl.leave_day_fraction_total > 1, false) AS has_leave_fraction_error,

    -- Paid vs. unpaid leave, for payroll prep -- see daily_leave's own
    -- comment for the is_paid confirmation caveat. Left nullable when no
    -- leave that day, matching leave_day_fraction's own existing
    -- (uncoalesced) convention exactly.
    dl.paid_leave_day_fraction,
    dl.unpaid_leave_day_fraction,

    -- Public holidays / company off-days -- always populated regardless of
    -- which hr_flag branch fired above, mirroring is_on_leave/
    -- leave_type_codes's exact existing pattern. This matters because
    -- someone who actually worked ON a holiday still correctly falls
    -- through to Approved/OK (they DID work) -- but is_public_holiday
    -- stays true on that row either way, so the fact isn't lost (feeds a
    -- future "worked on a public holiday" OT-rate signal, not built yet --
    -- see docs/PAYROLL-DATA-REQUIREMENTS.md).
    (dh.holiday_name IS NOT NULL) AS is_public_holiday,
    dh.holiday_name AS public_holiday_name,

    -- Worked on a public holiday -- a genuine, payroll-relevant fact (not
    -- necessarily an error) needing HR reconciliation before payroll: real
    -- attendance on a day nobody was expected to work. Existence-based
    -- (hw_check_in/app_check_in present), mirroring
    -- is_leave_attendance_conflict's own check -- not hours_worked > 0, so
    -- a data quirk that computes 0 hours despite a real check-in still
    -- counts as "attended."
    COALESCE(
        dh.holiday_name IS NOT NULL
        AND (h.hw_check_in IS NOT NULL OR a.app_check_in IS NOT NULL),
        false
    ) AS is_worked_on_holiday,

    -- Hours actually worked on that holiday -- the concrete number HR
    -- reconciles against payroll. Repeats hours_worked's own expression
    -- rather than referencing that alias -- a SELECT list can't reference
    -- a sibling output column's alias (same constraint this view's other
    -- repeated expressions already document).
    CASE
        WHEN dh.holiday_name IS NOT NULL
        THEN GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0)
        ELSE 0
    END AS holiday_hours_worked,

    -- Weekend / rest day -- an independent, always-on calendar fact (see
    -- expected_shifts above). Replaces the old 'Weekend / Rest Day' hr_flag
    -- value: filters/KPIs/UI should key off this boolean, never a string
    -- match against hr_flag, since hr_flag can no longer represent
    -- "weekend" at all. Appended last per this view's append-only
    -- constraint.
    u.is_weekend,

    -- Worked on a weekend -- mirrors is_worked_on_holiday exactly.
    -- Existence-based (hw_check_in/app_check_in present), not
    -- hours_worked > 0, so a data quirk that computes 0 hours despite a
    -- real check-in still counts as "attended." Not mutually exclusive
    -- with is_worked_on_holiday -- a Saturday that also happens to be a
    -- public holiday can be true for both; that's intentional, same as
    -- every other independently-populated flag on this view (is_on_leave/
    -- is_public_holiday coexist the same way).
    COALESCE(
        u.is_weekend
        AND (h.hw_check_in IS NOT NULL OR a.app_check_in IS NOT NULL),
        false
    ) AS is_worked_on_weekend,

    -- Hours actually worked on that weekend day -- mirrors
    -- holiday_hours_worked exactly, repeating hours_worked's own expression
    -- rather than referencing its alias (same constraint every other
    -- repeated expression in this view already documents).
    CASE
        WHEN u.is_weekend
        THEN GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0)
        ELSE 0
    END AS weekend_hours_worked

FROM expected_shifts u
LEFT JOIN daily_hardware h ON u.company_employee_code = h.scanner_emp_id AND u.work_date = h.work_date
LEFT JOIN daily_hw_remote_overlap ro ON u.employee_uuid = ro.app_emp_uuid AND u.work_date = ro.work_date
LEFT JOIN daily_app a ON u.employee_uuid = a.app_emp_uuid AND u.work_date = a.work_date
LEFT JOIN daily_leave dl ON u.employee_uuid = dl.leave_emp_uuid AND u.work_date = dl.work_date
LEFT JOIN daily_holiday dh ON u.employee_uuid = dh.holiday_emp_uuid AND u.work_date = dh.work_date
LEFT JOIN public.departments d ON u.department_id = d.id
LEFT JOIN public.employees m ON u.manager_id = m.id
LEFT JOIN public.profiles p ON u.profile_id = p.id
LEFT JOIN public.work_locations wl ON wl.id = u.work_location_id;
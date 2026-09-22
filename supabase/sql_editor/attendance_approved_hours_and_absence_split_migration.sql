-- ############################################################################
-- SUPERSEDED (2026-09-22) BY attendance_employment_act_overtime_migration.sql
-- -- DO NOT RE-RUN.
--
-- This file contains a COMPLETE `CREATE OR REPLACE VIEW
-- public.unified_daily_attendance` carrying the OLD "overtime = hours after
-- 6PM, gated on >8h" formula. Re-running it would silently revert the
-- Employment Act s.60A overtime redefinition and quietly change payroll
-- figures back. Kept only as the historical record of the deployment step it
-- performed at the time.
--
-- If you need this view, run attendance_employment_act_overtime_migration.sql
-- instead -- it is a full superset of everything below.
-- ############################################################################

-- DEPLOYMENT STEP -- run once in the Supabase SQL editor, after every step in
-- docs/setup/ATTENDANCE-BACKFILL-DEPLOYMENT-GUIDE.md and after
-- attendance_reconciliation_flags_view_migration.sql have already been run
-- (this builds on the final_rows CTE / needs_reconciliation columns that
-- migration adds to unified_daily_attendance).
--
-- REVISION NOTE: an earlier version of this file appended the new
-- approved_* columns INSIDE final_rows, which placed them (once flattened by
-- fr.* in the outer SELECT) BEFORE the already-deployed
-- is_unacknowledged_absent/is_unacknowledged_insufficient_half_day/
-- needs_reconciliation tail columns -- Postgres reads that as renaming an
-- existing column, not appending, and refuses with 42P16 ("cannot change
-- name of view column"). Fixed by moving every new column into the OUTER
-- SELECT instead, strictly after needs_reconciliation, referencing fr.*'s
-- already-exposed columns (hours_worked/overtime_hours/holiday_hours_worked/
-- weekend_hours_worked/is_weekend/is_public_holiday) plus one extra join
-- back to daily_app (already a top-level CTE, not re-declared) to reach
-- approved_app_hours/app_hours -- neither of which final_rows exposes as its
-- own output column.
--
-- Two independent, additive fixes to Payroll Export's data, bundled into one
-- deployment step since both touch the same view + RPC pair:
--
-- 1. ACKNOWLEDGED/UNACKNOWLEDGED ABSENCE SPLIT -- get_payroll_period_summary
--    already computed unacknowledgedAbsenceCount, but it only ever fed the
--    on-screen "Needs Reconciliation" filter/badge -- the actual CSV payroll
--    receives showed one "Days Absent" number with no visibility into how
--    many are confirmed vs. still pending review. Adds acknowledgedAbsenceCount
--    (the exact complement: acknowledgedAbsenceCount + unacknowledgedAbsenceCount
--    = daysAbsentCount, always) so Payroll Export can show HR that split
--    explicitly. daysAbsentCount itself is UNCHANGED -- still every Absent day
--    regardless of review status, per this RPC's own long-standing, HR-confirmed
--    "acknowledging closes the review, not the fact" decision.
--
-- 2. APPROVED-ONLY PAYROLL HOURS -- unified_daily_attendance's hours_worked/
--    overtime_hours/holiday_hours_worked/weekend_hours_worked have always
--    included hours from Pending (not-yet-approved) app activities, exactly
--    like Approved ones -- only Rejected was ever excluded. That's the correct
--    signal for hr_flag/dashboards/attendance-rate ("did something happen" is
--    reasonably optimistic), but Payroll Export was silently paying out for
--    claims nobody has verified, with no way to claw it back if one is later
--    rejected. Adds approved_app_hours/approved_hours_worked/
--    approved_overtime_hours/approved_holiday_hours_worked/
--    approved_weekend_hours_worked/pending_approval_hours to the view (all
--    NEW, additive columns -- the raw ones are untouched, so every other
--    consumer of this view is unaffected), and switches
--    get_payroll_period_summary's headline hoursWorkedTotal/overtimeHoursTotal/
--    holidayHoursWorkedTotal/weekendHoursWorkedTotal to source from the
--    approved-only columns instead, plus exposes the withheld amount as
--    pendingApprovalHoursTotal rather than have it silently disappear.
--
-- Both changes are purely additive at the view level (new trailing columns
-- only) and purely a source-column swap + 3 new JSON keys at the RPC level
-- (get_payroll_period_summary_rpc.sql returns plain `json`, not
-- `RETURNS TABLE`, so a plain CREATE OR REPLACE FUNCTION is enough -- no DROP
-- FUNCTION needed first). Kept byte-for-byte in sync with
-- hr_unified_daily_attendance_view.sql / get_payroll_period_summary_rpc.sql,
-- this repo's canonical copies of both -- update all three together if this
-- ever changes again.

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
    -- Never let a FUTURE activity date into the spine. This branch is the one
    -- that reacts to real rows in attendance_activities, and since HR (and an
    -- employee reconciling their own days) can now create a row for a date
    -- that hasn't happened yet -- pre-recording an approved business trip, for
    -- instance -- without this bound, one such row would add that date to the
    -- spine, which CROSS JOINs expected_shifts, which generates a row for
    -- EVERY active employee on that date, every one of them flagged 'Absent'.
    -- That would silently corrupt absent_days_count, attendanceRatePct,
    -- absenteeismRatePct and the Top Absenteeism leaderboard in both dashboard
    -- RPCs with a day nobody has lived through yet.
    --
    -- The weekend generate_series below deliberately DOES run a year forward,
    -- and that stays correct: a future weekend row reads is_weekend = true, so
    -- getDisplayAttendanceFlag renders it grey as "Weekend" and every RPC
    -- denominator already excludes it. A future WEEKDAY has no such treatment
    -- and would read as a genuine red absence.
    --
    -- The future row itself is not lost -- it stays in attendance_activities
    -- (so the claims/allowance layer can read a planned trip) and enters this
    -- view normally once its date arrives.
    --
    -- MYT, not CURRENT_DATE: Supabase's database timezone is UTC, so between
    -- 00:00 and 08:00 MYT, CURRENT_DATE is still yesterday in local terms and
    -- would wrongly exclude a legitimate same-day record.
    WHERE work_date <= (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date
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
        ) / 3600)::numeric, 2) AS app_hours,

        -- Payroll-eligible counterpart of app_hours above -- Approved ONLY,
        -- not Pending. app_hours (and therefore hours_worked/overtime_hours/
        -- holiday_hours_worked/weekend_hours_worked, all built from it)
        -- deliberately still includes Pending activities -- that's the
        -- correct "did something happen" signal for hr_flag/dashboards/
        -- attendance-rate (an employee's own asserted business trip
        -- shouldn't read as Absent while a manager hasn't gotten to it yet).
        -- But paying out for a claim nobody has verified is a different
        -- question, and industry-standard payroll practice is to hold that
        -- pay until approved -- a Pending activity may still be rejected.
        -- See this view's own approved_hours_worked/approved_overtime_hours/
        -- approved_holiday_hours_worked/approved_weekend_hours_worked/
        -- pending_approval_hours (in the outer SELECT, after
        -- needs_reconciliation) and get_payroll_period_summary_rpc.sql, which
        -- sources its headline payroll totals from those instead of the raw
        -- ones. Every OTHER consumer of this view keeps reading the raw,
        -- Pending-inclusive columns unchanged.
        ROUND((SUM(
            CASE
                WHEN aa.approval_status::text = 'Approved' THEN EXTRACT(EPOCH FROM (aa.clocked_out_at - aa.clocked_in_at))
                ELSE 0
            END
        ) / 3600)::numeric, 2) AS approved_app_hours

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
),

-- Wraps the view's entire original SELECT (unchanged) in its own CTE so the
-- new outer SELECT below can reference already-computed columns like
-- hr_flag/is_weekend/is_leave_attendance_conflict by NAME -- a SELECT list
-- can't reference a sibling output column's own alias (this view's own
-- long-established constraint, see overtime_hours/is_late_arrival's own
-- comments below), so without this wrapper the new is_unacknowledged_absent/
-- needs_reconciliation columns below would have to re-derive hr_flag's
-- entire CASE expression instead of just testing it.
final_rows AS (

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

    -- Overtime: hours worked after 6PM, but ONLY on a normal working day
    -- (not weekend/public holiday) AND only when that day's TOTAL hours
    -- worked exceed 8. Corrected 2026-09-15 after two confirmed issues with
    -- the original "any time after 6PM, regardless of arrival time or total
    -- hours" rule:
    --   1. It double-counted with weekend_hours_worked/holiday_hours_worked
    --      -- a Saturday shift past 6PM registered both full weekend hours
    --      AND separate overtime hours on top of them. Malaysian OT/rest-day
    --      pay convention pays that whole shift at its own premium rate
    --      (1.5x/2x/3x under the Employment Act), not "normal rate +
    --      separate OT on top" -- so overtime is now forced to 0 whenever
    --      is_weekend or is_public_holiday is true; those hours are already
    --      fully captured by weekend_hours_worked/holiday_hours_worked
    --      below.
    --   2. A late-arriving-but-normal-length day (e.g. in at noon, out at
    --      8pm -- a plain 8 hours, just shifted later) registered 2h of
    --      "overtime" purely because the clock-out happened to be after
    --      6PM, with no check on total hours worked. Now gated: a day must
    --      have MORE than 8 total hours worked before any overtime is
    --      reported at all. Once both gates pass, the reported quantity is
    --      still specifically "hours worked after 6PM" (not
    --      hours-worked-minus-8) -- unchanged from the original formula.
    -- See docs/PAYROLL-DATA-REQUIREMENTS.md's "Overtime hours" row and
    -- docs/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md for the related,
    -- still-open gap: none of this is reconciled against HR's actual
    -- (still paper-based) overtime/weekend/holiday approval process.
    --
    -- The inner GREATEST/EXTRACT expression (unchanged from before) is
    -- null-safe: GREATEST ignores NULL arguments rather than propagating
    -- them, so a day with no checkin at all still computes to 0. It also
    -- still bounds its window's start to the LATER of (actual first
    -- arrival, 6PM) -- fixes a separate, earlier bug where someone whose
    -- entire day started after 6PM (e.g. clocked in 9PM, out 11PM) would
    -- otherwise show 5h of overtime (11PM minus a flat 6PM) instead of the
    -- real 2h. Repeats the same MAX(...)/MIN(...) expressions last_out/
    -- first_in_time_of_day above already use, and the same hours_worked
    -- expression this view's other columns already repeat -- a SELECT list
    -- can't reference a sibling output column's alias, and restructuring
    -- this view into a wrapping CTE is a bigger change than this fix
    -- warrants.
    CASE
        WHEN u.is_weekend OR dh.holiday_name IS NOT NULL THEN 0
        WHEN (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0)) <= 8 THEN 0
        ELSE GREATEST(
            EXTRACT(EPOCH FROM (
                (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))::time
                - GREATEST(
                    (SELECT MIN(v) FROM (VALUES (a.app_check_in), (h.hw_check_in)) AS t(v))::time,
                    TIME '18:00:00'
                  )
            )) / 3600.0,
            0
        )
    END AS overtime_hours,

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
    END AS weekend_hours_worked,

    -- ===================================================================
    -- STATUTORY RATE-TIER ESTIMATE (added 2026-09-15) -- ESTIMATE ONLY,
    -- for reconciliation against the real, claims-module-driven "actuals"
    -- once that's built (see docs/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md)
    -- -- never itself the payable figure. Verified against Malaysia's
    -- Employment Act 1955 ss.60/60A/60D (monthly-rated employee tiers):
    -- normal-day OT is a clean 1.5x hourly rate; rest-day/holiday pay for
    -- the "up to normal hours" portion is a flat day-wage fraction (NOT a
    -- continuous hourly multiplier), with only the hours BEYOND normal
    -- hours paid per-hour (2x rest day / 3x holiday, additive on top of
    -- the day-wage base -- best-available reading, flagged in
    -- docs/PAYROLL-DATA-REQUIREMENTS.md as needing final HR/payroll
    -- sign-off since sources weren't 100% explicit on the additive point).
    --
    -- Deliberately separate, new columns rather than redefining
    -- overtime_hours above a third time -- that column stays exactly as
    -- shipped (a simple "worked past 6PM" anomaly/badge signal already
    -- consumed elsewhere); this is a more precise, statute-driven estimate
    -- for payroll reconciliation specifically.
    --
    -- Schedule facts this relies on (confirmed, not guessed): every
    -- employee's shift starts 08:30, ends at their work location's
    -- early_leave_time (17:00 KL / 17:30 Meru -- reused directly, despite
    -- originally being the is_early_leave threshold, because it already
    -- holds exactly these locations' official shift-end times), minus a
    -- flat 1-hour unpaid lunch baked into the raw punch span (not
    -- separately punched). Resulting normal_hours_threshold: 7.5h KL, 8h
    -- Meru. This 1-hour deduction is scoped ONLY to this estimate -- it
    -- does NOT change hours_worked itself (used elsewhere for attendance
    -- stats/is_insufficient_half_day_hours, out of scope to touch here).

    -- Normal daily hours for this employee's work location (shift end
    -- minus 08:30 start, minus the 1-hour lunch). Exposed for
    -- transparency/debugging, not just an intermediate value.
    EXTRACT(EPOCH FROM (COALESCE(wl.early_leave_time, TIME '17:00:00') - TIME '08:30:00')) / 3600.0 - 1
        AS normal_hours_threshold,

    -- "True" hours worked for rate-tier comparison purposes only --
    -- hours_worked's own expression minus the 1-hour lunch, floored at 0.
    GREATEST(0, GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
        AS true_hours_worked,

    -- Normal-day overtime: hours beyond this location's
    -- normal_hours_threshold, entitled to 1.5x hourly rate (s.60A). Zero on
    -- weekend/public-holiday days -- those use the rest-day/holiday tiers
    -- below instead, never both.
    CASE
        WHEN u.is_weekend OR dh.holiday_name IS NOT NULL THEN 0
        ELSE GREATEST(0,
            (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
            - (EXTRACT(EPOCH FROM (COALESCE(wl.early_leave_time, TIME '17:00:00') - TIME '08:30:00')) / 3600.0 - 1)
        )
    END AS estimated_normal_day_ot_hours,

    -- Rest-day (weekend) day-wage tier (s.60(3)): 0.5 day's wages if worked
    -- hours <= half normal_hours_threshold, 1 day's wages if > half but <=
    -- normal_hours_threshold (this base tier still applies even when hours
    -- exceed normal_hours_threshold -- see rest_day_excess_hours below,
    -- additive on top). NULL when not a weekend, or no work done that day.
    CASE
        WHEN NOT u.is_weekend THEN NULL
        WHEN (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1) <= 0 THEN NULL
        WHEN (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
             <= (EXTRACT(EPOCH FROM (COALESCE(wl.early_leave_time, TIME '17:00:00') - TIME '08:30:00')) / 3600.0 - 1) / 2
        THEN 'half_day'
        ELSE 'full_day'
    END AS rest_day_wage_tier,

    -- Rest-day hours beyond normal_hours_threshold (s.60(3)(c)): additional
    -- 2x hourly rate, on top of the day-wage tier above.
    CASE
        WHEN NOT u.is_weekend THEN 0
        ELSE GREATEST(0,
            (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
            - (EXTRACT(EPOCH FROM (COALESCE(wl.early_leave_time, TIME '17:00:00') - TIME '08:30:00')) / 3600.0 - 1)
        )
    END AS rest_day_excess_hours,

    -- Public holiday day-wage tier (s.60D(3)): 2 days' wages for ANY work
    -- up to normal_hours_threshold -- no half-day sub-tier, unlike rest
    -- days (any nonzero holiday attendance triggers the full tier).
    CASE
        WHEN dh.holiday_name IS NULL THEN NULL
        WHEN (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1) <= 0 THEN NULL
        ELSE 'full_day'
    END AS holiday_wage_tier,

    -- Holiday hours beyond normal_hours_threshold (s.60D(3)(aa)): additional
    -- 3x hourly rate, on top of the day-wage tier above.
    CASE
        WHEN dh.holiday_name IS NULL THEN 0
        ELSE GREATEST(0,
            (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
            - (EXTRACT(EPOCH FROM (COALESCE(wl.early_leave_time, TIME '17:00:00') - TIME '08:30:00')) / 3600.0 - 1)
        )
    END AS holiday_excess_hours

FROM expected_shifts u
LEFT JOIN daily_hardware h ON u.company_employee_code = h.scanner_emp_id AND u.work_date = h.work_date
LEFT JOIN daily_hw_remote_overlap ro ON u.employee_uuid = ro.app_emp_uuid AND u.work_date = ro.work_date
LEFT JOIN daily_app a ON u.employee_uuid = a.app_emp_uuid AND u.work_date = a.work_date
LEFT JOIN daily_leave dl ON u.employee_uuid = dl.leave_emp_uuid AND u.work_date = dl.work_date
LEFT JOIN daily_holiday dh ON u.employee_uuid = dh.holiday_emp_uuid AND u.work_date = dh.work_date
LEFT JOIN public.departments d ON u.department_id = d.id
LEFT JOIN public.employees m ON u.manager_id = m.id
LEFT JOIN public.profiles p ON u.profile_id = p.id
LEFT JOIN public.work_locations wl ON wl.id = u.work_location_id
)

-- ===========================================================================
-- ATTENDANCE RECONCILIATION -- acknowledgement-aware flags (added 2026-09-22).
-- Mirrors get_payroll_reconciliation_rows()'s predicate EXACTLY (see that
-- function's own header comment) so a day flagged here can never silently
-- disagree with Payroll Export's counts or the HR reconciliation
-- drilldown/email -- keep all three in sync if this predicate ever changes.
-- Only 'absent' and 'insufficient_half_day' are acknowledgeable (per
-- attendance_reconciliation_acknowledgements_migration.sql); leave_conflict
-- and leave_fraction_error self-resolve on the next HR2000 sync and are
-- never suppressed here, same as in get_payroll_reconciliation_rows().
--
-- Safe to join directly (not through a SECURITY DEFINER function): this view
-- runs with security_invoker = on (enable_attendance_views_security_
-- invoker.sql), so attendance_reconciliation_acknowledgements' own RLS
-- (self / manager / HR / superadmin -- attendance_reconciliation_
-- acknowledgements_migration.sql) is evaluated as the calling role, exactly
-- the same tiers each of this view's own callers already needs.
-- ===========================================================================
SELECT
    fr.*,

    (fr.hr_flag = 'Absent' AND NOT fr.is_weekend AND NOT fr.is_public_holiday
        AND ack_absent.id IS NULL) AS is_unacknowledged_absent,

    (fr.is_insufficient_half_day_hours AND ack_half_day.id IS NULL)
        AS is_unacknowledged_insufficient_half_day,

    (
        (fr.hr_flag = 'Absent' AND NOT fr.is_weekend AND NOT fr.is_public_holiday
            AND ack_absent.id IS NULL)
        OR fr.is_leave_attendance_conflict
        OR (fr.is_insufficient_half_day_hours AND ack_half_day.id IS NULL)
        OR fr.has_leave_fraction_error
    ) AS needs_reconciliation,

    -- ===================================================================
    -- APPROVED-ONLY PAYROLL HOURS (added 2026-09-22) -- see daily_app's own
    -- approved_app_hours comment for why these exist alongside, not instead
    -- of, fr.hours_worked/fr.overtime_hours/fr.holiday_hours_worked/
    -- fr.weekend_hours_worked. Appended here (in the outer SELECT, after
    -- needs_reconciliation), not inside final_rows -- final_rows' own output
    -- list is already, itself, positionally frozen (it's what the currently
    -- deployed view already ends with up through needs_reconciliation);
    -- anything added inside final_rows would land BEFORE
    -- is_unacknowledged_absent/needs_reconciliation once flattened by fr.*
    -- above, which Postgres treats as renaming an existing column rather than
    -- appending (42P16), not silently reordering it.
    --
    -- Needs its own join back to daily_app (already defined once, above, as
    -- a top-level CTE alongside final_rows -- not re-declared here) purely
    -- to reach approved_app_hours/app_hours, neither of which final_rows
    -- exposes as its own output column (only the already-combined
    -- hours_worked/overtime_hours/etc. are). One row at most per join, same
    -- guarantee daily_app's own GROUP BY (employee_id, work_date) already
    -- gives every other consumer of it.
    -- ===================================================================

    GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0))
        AS pending_approval_hours,

    GREATEST(0, fr.hours_worked - GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0)))
        AS approved_hours_worked,

    -- Overtime is envelope-based (last clock-out minus max(first clock-in,
    -- 6PM)), not a plain sum of app_hours, so it can't take the same direct
    -- "hours_worked minus pending" subtraction quite as literally -- but the
    -- subtraction is still a safe, conservative approximation of the true
    -- approved-only envelope figure: it can only ever REDUCE reported
    -- overtime relative to a fully recomputed approved-only envelope, never
    -- inflate it, so it stays safely on the side of not overpaying. A real
    -- approved-only clock envelope (its own approved-only first-in/last-out
    -- pair) would be needed for exact precision -- out of scope here.
    GREATEST(0, fr.overtime_hours - GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0)))
        AS approved_overtime_hours,

    CASE
        WHEN fr.is_public_holiday
        THEN GREATEST(0, fr.holiday_hours_worked - GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0)))
        ELSE 0
    END AS approved_holiday_hours_worked,

    CASE
        WHEN fr.is_weekend
        THEN GREATEST(0, fr.weekend_hours_worked - GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0)))
        ELSE 0
    END AS approved_weekend_hours_worked

FROM final_rows fr
LEFT JOIN public.attendance_reconciliation_acknowledgements ack_absent
    ON ack_absent.employee_id = fr.employee_uuid
   AND ack_absent.work_date = fr.work_date
   AND ack_absent.category = 'absent'
LEFT JOIN public.attendance_reconciliation_acknowledgements ack_half_day
    ON ack_half_day.employee_id = fr.employee_uuid
   AND ack_half_day.work_date = fr.work_date
   AND ack_half_day.category = 'insufficient_half_day'
LEFT JOIN daily_app a2
    ON a2.app_emp_uuid = fr.employee_uuid
   AND a2.work_date = fr.work_date;

-- ===========================================================================
-- get_payroll_period_summary -- switched to the approved-only hour columns
-- above, plus the new acknowledged/pending absence + pending-approval-hours
-- fields. See get_payroll_period_summary_rpc.sql (this repo's canonical copy)
-- for the full header comment this function otherwise carries.
-- ===========================================================================
create or replace function get_payroll_period_summary(
    p_start_date       date,
    p_end_date         date,
    p_department_id    bigint default null,
    p_employee_id      uuid default null,
    p_work_location_id bigint default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_is_hr_or_superadmin boolean;
begin

select (public.is_superadmin() or p.department_id = 7)
into v_is_hr_or_superadmin
from public.profiles p
where p.id = auth.uid();

if not coalesce(v_is_hr_or_superadmin, false) then
    raise exception 'Unauthorized: get_payroll_period_summary requires HR/superadmin' using errcode = '42501';
end if;

if p_start_date is null or p_end_date is null then
    raise exception 'get_payroll_period_summary requires both p_start_date and p_end_date' using errcode = '22004';
end if;

with period_rows as materialized (
    select uda.*
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and uda.work_date >= p_start_date
    and uda.work_date <= p_end_date
),

employee_leave_rows as (
    select
        le.employee_id as leave_emp_uuid,
        le.day_fraction,
        lt.is_paid
    from leave_ledger_entries le
    join leave_ledger_types lt on lt.id = le.leave_type_id
    join employees e on e.id = le.employee_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or le.employee_id = p_employee_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
    and le.leave_date >= p_start_date
    and le.leave_date <= p_end_date
),

period_acknowledgements as (
    select ack.employee_id, ack.work_date, ack.category
    from attendance_reconciliation_acknowledgements ack
    where ack.work_date >= p_start_date
      and ack.work_date <= p_end_date
),

attendance_summary as (
    select
        period_rows.employee_uuid,
        max(company_employee_code) as company_employee_code,
        max(full_name) as full_name,
        max(department_name) as department_name,
        -- Payroll-eligible (Approved-only) hours -- see
        -- hr_unified_daily_attendance_view.sql's approved_app_hours/
        -- approved_hours_worked/approved_overtime_hours own comments. Sourced
        -- from approved_hours_worked/approved_overtime_hours, NOT the raw
        -- hours_worked/overtime_hours (those stay Pending-inclusive for every
        -- other consumer of this view -- dashboards, attendance rate, etc.).
        round(sum(approved_hours_worked)::numeric, 2) as hours_worked_total,
        round(sum(approved_overtime_hours)::numeric, 2) as overtime_hours_total,
        round(sum(pending_approval_hours)::numeric, 2) as pending_approval_hours_total,
        count(*) filter (where hr_flag = 'Absent' and not is_weekend and not is_public_holiday) as days_absent_count,
        count(*) filter (where not is_weekend and not is_public_holiday) as total_working_days_count,
        count(*) filter (
            where not is_weekend and not is_public_holiday
            and hr_flag in ('OK', 'Approved', 'Pending App Approval', 'Missing App Check-Out', 'Incomplete Card Scans')
        ) as actual_days_worked_count,
        count(*) filter (where is_worked_on_holiday) as holiday_days_worked_count,
        -- Approved-only sum (see hours_worked_total's own comment above) --
        -- is_worked_on_holiday itself stays existence-based/unchanged (a real
        -- check-in happened, regardless of approval), only the HOURS summed
        -- switch to the approved-only column.
        round(sum(approved_holiday_hours_worked) filter (where is_worked_on_holiday)::numeric, 2) as holiday_hours_worked_total,
        count(*) filter (where is_worked_on_weekend) as weekend_days_worked_count,
        round(sum(approved_weekend_hours_worked) filter (where is_worked_on_weekend)::numeric, 2) as weekend_hours_worked_total,
        count(*) filter (where is_leave_attendance_conflict) as leave_attendance_conflict_count,
        count(*) filter (where is_insufficient_half_day_hours) as insufficient_half_day_hours_count,
        count(*) filter (
            where hr_flag = 'Absent' and not is_weekend and not is_public_holiday
              and ack_absent.employee_id is null
        ) as unacknowledged_absence_count,
        -- CONFIRMED (already reviewed) counterpart -- same base predicate as
        -- days_absent_count, just the opposite acknowledgement direction from
        -- unacknowledged_absence_count above. acknowledged_absence_count +
        -- unacknowledged_absence_count = days_absent_count, always -- surfaced
        -- explicitly so Payroll Export can show HR the split instead of
        -- leaving "how many of these Days Absent are actually confirmed"
        -- invisible.
        count(*) filter (
            where hr_flag = 'Absent' and not is_weekend and not is_public_holiday
              and ack_absent.employee_id is not null
        ) as acknowledged_absence_count,
        count(*) filter (
            where is_insufficient_half_day_hours
              and ack_half_day.employee_id is null
        ) as unacknowledged_insufficient_half_day_count,
        count(*) filter (where has_leave_fraction_error) as leave_fraction_error_count,
        round(sum(estimated_normal_day_ot_hours)::numeric, 2) as estimated_normal_day_ot_hours_total,
        count(*) filter (where rest_day_wage_tier = 'half_day') as estimated_rest_day_half_tier_days_count,
        count(*) filter (where rest_day_wage_tier = 'full_day') as estimated_rest_day_full_tier_days_count,
        round(sum(rest_day_excess_hours)::numeric, 2) as estimated_rest_day_excess_hours_total,
        count(*) filter (where holiday_wage_tier = 'full_day') as estimated_holiday_full_tier_days_count,
        round(sum(holiday_excess_hours)::numeric, 2) as estimated_holiday_excess_hours_total
    from period_rows
    left join period_acknowledgements ack_absent
        on ack_absent.employee_id = period_rows.employee_uuid
       and ack_absent.work_date = period_rows.work_date
       and ack_absent.category = 'absent'
    left join period_acknowledgements ack_half_day
        on ack_half_day.employee_id = period_rows.employee_uuid
       and ack_half_day.work_date = period_rows.work_date
       and ack_half_day.category = 'insufficient_half_day'
    group by period_rows.employee_uuid
),

leave_summary as (
    select
        leave_emp_uuid,
        coalesce(sum(day_fraction) filter (where is_paid), 0) as paid_leave_days_total,
        coalesce(sum(day_fraction) filter (where not is_paid), 0) as unpaid_leave_days_total
    from employee_leave_rows
    group by leave_emp_uuid
)

select json_agg(
    json_build_object(
        'employeeUuid', a.employee_uuid,
        'companyEmployeeCode', a.company_employee_code,
        'fullName', a.full_name,
        'departmentName', a.department_name,
        'hoursWorkedTotal', a.hours_worked_total,
        'overtimeHoursTotal', a.overtime_hours_total,
        'totalWorkingDaysCount', a.total_working_days_count,
        'actualDaysWorkedCount', a.actual_days_worked_count,
        'daysAbsentCount', a.days_absent_count,
        'holidayDaysWorkedCount', a.holiday_days_worked_count,
        'holidayHoursWorkedTotal', coalesce(a.holiday_hours_worked_total, 0),
        'weekendDaysWorkedCount', a.weekend_days_worked_count,
        'weekendHoursWorkedTotal', coalesce(a.weekend_hours_worked_total, 0),
        'paidLeaveDaysTotal', coalesce(l.paid_leave_days_total, 0),
        'unpaidLeaveDaysTotal', coalesce(l.unpaid_leave_days_total, 0),
        'leaveAttendanceConflictCount', a.leave_attendance_conflict_count,
        'insufficientHalfDayHoursCount', a.insufficient_half_day_hours_count,
        'unacknowledgedAbsenceCount', a.unacknowledged_absence_count,
        'acknowledgedAbsenceCount', a.acknowledged_absence_count,
        'unacknowledgedInsufficientHalfDayCount', a.unacknowledged_insufficient_half_day_count,
        'pendingApprovalHoursTotal', coalesce(a.pending_approval_hours_total, 0),
        'leaveFractionErrorCount', a.leave_fraction_error_count,
        'estimatedNormalDayOtHoursTotal', coalesce(a.estimated_normal_day_ot_hours_total, 0),
        'estimatedRestDayHalfTierDaysCount', a.estimated_rest_day_half_tier_days_count,
        'estimatedRestDayFullTierDaysCount', a.estimated_rest_day_full_tier_days_count,
        'estimatedRestDayExcessHoursTotal', coalesce(a.estimated_rest_day_excess_hours_total, 0),
        'estimatedHolidayFullTierDaysCount', a.estimated_holiday_full_tier_days_count,
        'estimatedHolidayExcessHoursTotal', coalesce(a.estimated_holiday_excess_hours_total, 0),
        'resolvedEmail', coalesce(emp.email_work, emp.email_personal),
        'emailSource', case
            when emp.email_work is not null then 'work'
            when emp.email_personal is not null then 'personal'
            else null
        end
    )
    order by a.full_name
) into result
from attendance_summary a
left join leave_summary l on l.leave_emp_uuid = a.employee_uuid
left join public.employees emp on emp.id = a.employee_uuid;

return coalesce(result, '[]'::json);

end;
$$;

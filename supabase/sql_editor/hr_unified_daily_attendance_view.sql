-- ===========================================================================
-- unified_daily_attendance -- one row per ACTIVE employee per spine date.
--
-- REBUILT 2026-09-22 (Ship 1 of the day-model rework). This file is now a
-- DROP + CREATE, not a CREATE OR REPLACE, for three reasons that could not be
-- satisfied any other way:
--   1. New columns of a type/position that CREATE OR REPLACE cannot express
--      (it can only append, and cannot change a column's name OR data type --
--      both raise 42P16).
--   2. Dropping estimated_normal_day_ot_hours, which has been an exact
--      duplicate of overtime_hours since the s.60A redefinition and has no
--      remaining reader anywhere in the repo. CREATE OR REPLACE cannot drop a
--      column at all.
--   3. security_invoker is now declared INLINE below instead of by a separate
--      ALTER VIEW (enable_attendance_views_security_invoker.sql, now
--      superseded). That separation was a live hazard: any DROP + CREATE that
--      forgot the follow-up ALTER would silently leave both views running with
--      OWNER privileges, so RLS on attendance_logs / employees /
--      attendance_reconciliation_acknowledgements would stop scoping rows --
--      My Attendance would list every employee and Team Attendance the whole
--      company, with both pages rendering perfectly and no error anywhere.
--      projects_tasks_views.sql:1-7 documents this same failure mode.
--
-- WHAT THIS ADDS: six orthogonal AXIS columns plus one derived day_state
-- label. The problem they solve is that hr_flag is a single string that has to
-- answer four unrelated questions at once -- what kind of calendar day is
-- this, what leave was recorded, how good is the evidence, and what is its
-- approval state -- by picking ONE winner via branch order. That makes real
-- states unreachable rather than merely mislabelled: an approved-but-never-
-- clocked-out session can never read 'Missing App Check-Out' (the 'Approved'
-- branch wins first), and a day with one badge scan PLUS an app activity can
-- never read 'Incomplete Card Scans'. With separate columns those are just
-- approval_state='approved' + evidence_quality='open_session', and
-- evidence_source='both' + evidence_quality='single_scan'.
--
-- hr_flag IS GONE (removed 2026-09-23, Ship 3). It survived one release as a
-- compatibility column so the ~34 frontend files and 10 SQL consumers that
-- read it could migrate in batches rather than in one atomic deploy. All of
-- them now read the axis columns, so it has been dropped.
--
-- It was never re-derived from the axes while it lived here, because it could
-- not be reproduced exactly: its 'Approved' branch used
-- BOOL_AND(status = 'Approved') across ALL activities INCLUDING Rejected ones,
-- so a day holding one Approved and one Rejected activity computed
-- all_approved = false and fell all the way through to 'OK' -- reporting
-- approved app work as a clean hardware-only day. approval_state deliberately
-- does not carry that quirk.
--
-- Two legacy query-string values outlive the column: attendanceOverviewService
-- .js still accepts `hrFlag=` and `dayType=` and TRANSLATES them onto the axis
-- columns, because notification emails sent before the migration carry those
-- params and live in inboxes indefinitely. Those read nothing from the
-- database, so dropping this column does not break them.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE, not DROP + CREATE.
--
-- Routine changes to this view must NOT drop it. `DROP VIEW ... CASCADE` also
-- drops attendance_activity_audit, which joins this view -- so a drop obliges
-- whoever runs it to run hr_attendance_activity_audit_view.sql immediately
-- afterwards, leaves the day sidebar with no data source in between, and
-- removes the sidebar entirely with nothing to explain why if that second
-- file is forgotten. CREATE OR REPLACE has none of that, is idempotent, and
-- still creates the view on a database that does not yet have it.
--
-- WHEN A DROP IS UNAVOIDABLE: CREATE OR REPLACE can rewrite the query body
-- however it likes and can APPEND columns, but it cannot DROP, RENAME or
-- RETYPE one -- those raise 42P16. Only then, and only for that one deploy:
--
--     DROP VIEW IF EXISTS public.unified_daily_attendance CASCADE;
--     CREATE VIEW public.unified_daily_attendance WITH (security_invoker = on) AS ...
--
-- then run hr_attendance_activity_audit_view.sql straight after, then restore
-- this file to CREATE OR REPLACE. It has been needed exactly twice: the Ship 1
-- axis rebuild, and the Ship 3 removal of hr_flag. It fails loudly, so there
-- is no way to need it and not notice.
--
-- security_invoker is restated below deliberately. Do NOT drop it: without it
-- the view falls back to OWNER privileges, RLS stops scoping rows, and every
-- page renders perfectly while showing the whole company.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.unified_daily_attendance
WITH (security_invoker = on) AS

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
    -- Computes this employee-day's outer scan bounds DIRECTLY from
    -- attendance_logs, rather than joining the daily_hardware CTE.
    --
    -- PERFORMANCE, and it is the difference between a fast page and a
    -- statement timeout. A non-recursive CTE referenced MORE THAN ONCE is
    -- materialized by Postgres in full, before any caller's predicate can
    -- reach it. daily_hardware used to be referenced twice -- here, and in the
    -- final join -- so every query against this view, even one asking for a
    -- SINGLE DAY, aggregated the entire attendance_logs table:
    --
    --     CTE daily_hardware
    --       -> HashAggregate  (actual time=82.8..90.7 rows=10534)
    --            -> Seq Scan on attendance_logs  (rows=51963)
    --
    -- That is ~90ms of pure database time on its own, but the real cost is
    -- what it does to RLS: these views run security_invoker = on, so each of
    -- those 51,963 rows has attendance_logs' five SELECT policies evaluated
    -- against it. A year-to-date query crossed the statement timeout outright.
    --
    -- Removing this second reference leaves daily_hardware referenced ONCE, so
    -- Postgres inlines it instead, and the outer work_date predicate can
    -- finally propagate into the scan and prune it.
    --
    -- The LATERAL is cheap because it is driven by attendance_activities,
    -- which is small (tens of rows), not by the date spine -- one bounded
    -- lookup per app activity, instead of aggregating the whole log table.
    --
    -- SEMANTICS UNCHANGED: this was an INNER JOIN, so an employee-day with no
    -- hardware scans contributed no overlap row at all. The
    -- `hw_check_in_ts IS NOT NULL` guard below reproduces exactly that -- an
    -- aggregate over zero rows returns one row of NULLs rather than no row,
    -- so without it a LATERAL would wrongly keep those days.
    CROSS JOIN LATERAL (
        SELECT MIN(al.scanned_at) AS hw_check_in_ts,
               MAX(al.scanned_at) AS hw_check_out_ts
        FROM public.attendance_logs al
        WHERE al.employee_id = e.employee_id
          AND DATE(al.scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur')
              = DATE(aa.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur')
    ) h
    WHERE aa.approval_status::text != 'Rejected'
      AND h.hw_check_in_ts IS NOT NULL
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

        -- Does this day hold ANY activity that was not rejected? Added 2026-09-22
        -- for the approval_state axis column, which needs to tell a day whose
        -- every activity was refused ('rejected_only') apart from a day with no
        -- app activity at all ('not_applicable') -- two genuinely different
        -- situations that all_approved/has_pending cannot distinguish (both
        -- compute false/false for a rejected-only day, and a day with no row
        -- here does not reach this CTE at all).
        --
        -- Deliberately NOT used to "fix" all_approved above. all_approved feeds
        -- hr_flag, which is frozen byte-for-byte in this rebuild so the
        -- deploy-time equality check stays meaningful. Its known quirk -- one
        -- Approved plus one Rejected activity yields all_approved = false, so
        -- hr_flag falls through to 'OK' -- is left exactly as it is and
        -- reported honestly by approval_state instead.
        BOOL_OR(aa.approval_status::text != 'Rejected') AS has_any_non_rejected,
        
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
        -- pending_approval_hours (below) and get_payroll_period_summary_rpc.sql,
        -- which sources its headline payroll totals from these instead of the
        -- raw ones. Every OTHER consumer of this view keeps reading the raw,
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
-- Wraps the day-grain SELECT in its own CTE so the outer SELECT below can
-- reference already-computed columns -- hr_flag, is_weekend,
-- is_leave_attendance_conflict, and now the axis columns that day_state is
-- built from -- by NAME. A SELECT list cannot reference a sibling output
-- column's own alias (this view's long-established constraint, see
-- overtime_hours/is_late_arrival's own comments below), so without this
-- wrapper is_unacknowledged_absent / needs_reconciliation / day_state would
-- each have to restate the entire expression they depend on rather than just
-- testing it -- which is precisely how a derived label drifts from the facts
-- it claims to summarise.
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


    -- Absolute First In (Ignores Rejected App Logs)
    (SELECT MIN(v) FROM (VALUES (a.app_check_in), (h.hw_check_in)) AS t(v)) AS first_in,

    -- Absolute Last Out (Ignores Rejected App Logs)
    --
    -- NULL ON A SINGLE-SCAN DAY (added 2026-09-23). daily_hardware computes
    -- hw_check_out as MAX(scanned_at), so on a day with exactly ONE scan
    -- MAX = MIN and the ARRIVAL scan was being reported as the departure.
    -- Someone who badged in at 08:45 and forgot to badge out was recorded as
    -- having LEFT at 08:45.
    --
    -- Fixed here at the source rather than in each consumer, because two of
    -- them already carry the right guard and simply never had anything to
    -- catch:
    --   * get_attendance_dashboard_rpc.sql's avg_check_out_time already says
    --     `and last_out is not null`, so it now excludes these days and stops
    --     dragging the company average check-out earlier.
    --   * is_early_leave below takes MAX over (app_check_out, hw_check_out);
    --     with both NULL the comparison yields NULL and its existing
    --     COALESCE(..., false) makes the flag false -- so a forgotten
    --     badge-out stops being counted as leaving early.
    -- This is the same class of bug avg_hours_worked already guards against
    -- with `evidence_quality not in ('single_scan', ...)`; that guard sits
    -- four lines below avg_check_out_time in the RPC and this column is why
    -- the second one was never needed there.
    --
    -- Only when the day's SOLE evidence is one hardware scan. An app
    -- check-out, or two or more scans, is unchanged. hw_check_out itself is
    -- deliberately NOT touched -- MAX(scanned_at) genuinely IS the last scan,
    -- it is a raw fact, and it feeds hw_hours and the remote-overlap window.
    -- Only this derived "when did this person leave" column changes.
    --
    -- first_in needs no equivalent guard: on a single-scan day it is a real
    -- arrival.
    CASE
        WHEN a.app_check_out IS NULL AND COALESCE(h.total_hw_scans, 0) = 1
            THEN NULL
        ELSE (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))
    END AS last_out,

    -- Time-of-day only versions of first_in/last_out -- lets the List page
    -- filter "first_in later than 9am" as a plain column comparison
    -- regardless of calendar date (a full timestamptz can't be compared
    -- against a bare time-of-day cutoff via PostgREST). Mirrors the same
    -- 09:00/18:00 thresholds get_attendance_dashboard_rpc.sql already uses
    -- for lateArrivalsCount/earlyLeaveCount, so the List filter and the RPC
    -- KPI can never disagree.
    (SELECT MIN(v) FROM (VALUES (a.app_check_in), (h.hw_check_in)) AS t(v))::time AS first_in_time_of_day,
    -- Same single-scan guard as last_out above -- restated rather than cast
    -- from that alias, because a SELECT list cannot reference a sibling
    -- output column (the constraint overtime_hours' own comment documents).
    -- If these two ever disagree, the List page's time-of-day filter would
    -- show a departure the day detail says does not exist.
    CASE
        WHEN a.app_check_out IS NULL AND COALESCE(h.total_hw_scans, 0) = 1
            THEN NULL
        ELSE (SELECT MAX(v) FROM (VALUES (a.app_check_out), (h.hw_check_out)) AS t(v))
    END::time AS last_out_time_of_day,

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

    -- Overtime, per Employment Act 1955 s.60A: hours worked beyond the
    -- normal hours of work in a day. REDEFINED 2026-09-22 -- this column
    -- previously meant "hours clocked after 6PM, gated on total hours > 8".
    -- That rule is gone. It was wrong for payroll in both directions: it
    -- paid nothing for a 09:00-19:00 ten-hour day (no post-6PM tail once
    -- the arrival floor applied), while the Act plainly counts every hour
    -- past normal hours regardless of what time of day they fall.
    --
    -- THRESHOLD: a flat 8 PAID hours, company-wide -- i.e. 9 hours of raw
    -- clock span, because the 1-hour unpaid lunch is baked into the punch
    -- span rather than separately punched (see true_hours_worked below).
    --
    -- PURELY DURATION-BASED. There is deliberately NO time-of-day component
    -- anywhere in this expression: hw_hours is just
    -- MAX(scanned_at) - MIN(scanned_at), so an early arrival earns overtime
    -- exactly like a late departure. Someone in at 07:30 and out at 17:30
    -- worked a 10h span = 9h paid = 1h overtime, even though they left at
    -- the usual time. (The old rule could not see that day at all, which is
    -- part of why it was replaced.)
    --
    -- Deliberately NOT per-work-location, even though work_locations
    -- .early_leave_time (17:00 KL / 17:30 Meru) would make it easy to be:
    -- confirmed with the business that KL's 17:00 finish is company
    -- LENIENCY, not a shorter contractual day, so both sites owe the same
    -- 8 hours before overtime starts. early_leave_time keeps driving
    -- is_early_leave and nothing else. This reverses the "overtime stays a
    -- flat 6:00 PM company-wide threshold forever" line in
    -- docs/hr/WORK-LOCATIONS-ARCHITECTURE.md's "decisions already made"
    -- section -- consciously, not by oversight. The conclusion it reached
    -- (overtime is company-wide, not per-location) survives; only its
    -- 6PM mechanism is replaced.
    --
    -- Weekend/public-holiday days stay forced to 0, unchanged and still
    -- correct: Malaysian convention pays a whole rest-day/holiday shift at
    -- its own premium tier (s.60(3)/s.60D(3)), not "normal rate + OT on
    -- top". Those hours are carried by weekend_hours_worked/
    -- holiday_hours_worked and the rate-tier columns below instead.
    --
    -- estimated_normal_day_ot_hours, which sat below and was an exact
    -- duplicate of this column, is GONE as of the 2026-09-22 rebuild. It only
    -- ever survived because CREATE OR REPLACE VIEW cannot drop a column;
    -- nothing in the repo read it. This column is the single s.60A figure now.
    -- Repeats hours_worked's expression rather than referencing its alias,
    -- per this view's standing constraint (a SELECT list can't reference a
    -- sibling output column's alias). Null-safe: GREATEST ignores NULLs, so
    -- a day with no punches at all computes to 0, not NULL.
    CASE
        WHEN u.is_weekend OR dh.holiday_name IS NOT NULL THEN 0
        ELSE GREATEST(0,
            (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
            - 8
        )
    END AS overtime_hours,

    -- Early leave: before this employee's assigned work location's cutoff
    -- (work_locations.early_leave_time), falling back to the flat 5PM
    -- default for employees not yet assigned one -- see
    -- docs/WORK-LOCATIONS-ARCHITECTURE.md. This COALESCE is the exact seam
    -- the prior pass's design left for this change: only the threshold
    -- expression changed, the column's shape/name/callers didn't.
    --
    -- NOT is_weekend / holiday / LEAVE guard: a day nobody was expected to
    -- work a full shift has no meaningful "leaving early" concept, regardless
    -- of what time attendance happened to end. Without the weekend/holiday
    -- guards, someone voluntarily working a Saturday who leaves at 4pm would
    -- be flagged exactly like a weekday violation.
    --
    -- The LEAVE guard was added 2026-09-23 and is the same class of bug: an
    -- employee on approved HALF-DAY AM leave works the morning and leaves at
    -- 12:30, which is before every work location's cutoff -- so they were
    -- flagged for leaving early on a day they were only ever expected to work
    -- half of. Any leave at all disqualifies the normal-day threshold, not
    -- just half days, because the expected shift is no longer the normal one.
    --
    -- Fixing it HERE rather than in each consumer is deliberate: this column
    -- drives the red badge on the attendance cards and the day sidebar as
    -- well as the dashboard KPI, and those were disagreeing -- the KPI
    -- filtered leave days out, the badge did not.
    --
    -- FULL-DAY GUARD (added 2026-09-23): no flag on a day that was worked in
    -- full. Someone in at 07:00 and out at 16:00 has done a 9-hour span --
    -- 8 paid hours, the whole contractual day, enough to start earning
    -- overtime if they went further -- and was still flagged for leaving
    -- before 17:00.
    --
    -- This aligns the flag with the rule the rest of the model already
    -- follows. docs/hr/PAYROLL-DATA-REQUIREMENTS.md's "Overtime hours" row is
    -- explicit that overtime is PURELY DURATION-BASED with no time-of-day
    -- component, so that "an early arrival earns overtime exactly like a late
    -- departure". Punctuality being purely clock-based while pay is purely
    -- duration-based was the real inconsistency.
    --
    -- Note this does NOT make the work-location cutoff redundant. HR confirmed
    -- (same doc) that KL's 17:00 finish is company LENIENCY, not a shorter
    -- contractual day -- both sites owe the same 8 paid hours. So the cutoff
    -- answers "did they leave before we allow?" and this guard answers "and
    -- did they come up short?". A day needs both to be flagged.
    --
    -- Restates true_hours_worked and normal_hours_threshold inline rather than
    -- referencing those aliases -- a SELECT list cannot reference a sibling
    -- output column, the same constraint overtime_hours' own comment
    -- documents. Keep the literal 8 in step with normal_hours_threshold below.
    -- SINGLE-SCAN GUARD (added 2026-09-23), the same fix last_out above
    -- carries -- and it has to be restated here, NOT inherited, because this
    -- expression rebuilds MAX(app_check_out, hw_check_out) from the base
    -- tables rather than reading last_out (a SELECT list cannot reference a
    -- sibling output column). On a one-scan day hw_check_out is NOT null --
    -- it is the arrival scan, since MAX = MIN -- so without this the flag
    -- fires on every forgotten badge-out: "left early at 08:45".
    COALESCE(
        NOT u.is_weekend AND dh.holiday_name IS NULL AND dl.leave_emp_uuid IS NULL
        AND NOT (a.app_check_out IS NULL AND COALESCE(h.total_hw_scans, 0) = 1)
        AND GREATEST(0, GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1) < 8
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
    -- NOT is_weekend / holiday / LEAVE guard: same reasoning as
    -- is_early_leave above -- "late" has no meaning on a day nobody was
    -- expected to work a normal shift.
    --
    -- The LEAVE guard (added 2026-09-23) matters most here: an employee on
    -- approved half-day AM leave arrives after lunch, which is hours past the
    -- 09:00 threshold, and was being flagged as a late arrival for taking
    -- leave they had been granted. That fed both the red badge on their card
    -- and HR's Late Arrivals KPI.
    -- FULL-DAY GUARD (added 2026-09-23): no flag on a day worked in full.
    -- Someone in at 09:30 and out at 18:30 has done the whole contractual day
    -- and was still flagged late. See is_early_leave's own comment above for
    -- the full reasoning -- in short, overtime is purely duration-based
    -- (docs/hr/PAYROLL-DATA-REQUIREMENTS.md), so punctuality being purely
    -- clock-based was the inconsistency. A genuinely short day (in at 09:30,
    -- out at 17:00) still flags, which is the case the KPI is actually for.
    --
    -- Restates true_hours_worked and normal_hours_threshold inline for the
    -- same sibling-alias reason as the arrival expression below. Keep the
    -- literal 8 in step with normal_hours_threshold and with is_early_leave.
    --
    -- No single-scan guard here, unlike is_early_leave: on a one-scan day
    -- first_in is a REAL arrival, so "were they late" is still answerable.
    -- Only the departure was fabricated.
    COALESCE(
        NOT u.is_weekend AND dh.holiday_name IS NULL AND dl.leave_emp_uuid IS NULL
        AND GREATEST(0, GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1) < 8
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
    -- CALENDAR GUARD added 2026-09-23. This previously tested only the leave
    -- fraction and the hours, with no weekend or holiday exclusion -- unlike
    -- is_unacknowledged_absent beside it, which has always carried one. HR2000
    -- does not prevent leave being recorded against a Saturday or a public
    -- holiday, and such a day trivially satisfies `= 0.5 AND 0 < 4`, so it was
    -- flagged as needing reconciliation forever.
    --
    -- That was not merely noise, it was an UNRESOLVABLE state: the day showed
    -- up in the reconciliation queue and in the employee's notifications, but
    -- acknowledge_attendance_day() would not accept it (its absent branch
    -- excluded non-working days, so HR could clear a Saturday absence but not
    -- a Saturday half-day). Flagged, chased, and impossible to close.
    COALESCE(
        NOT u.is_weekend AND dh.holiday_name IS NULL
        AND dl.leave_day_fraction_total = 0.5
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
    -- These columns are no longer "separate from" overtime_hours -- as of
    -- 2026-09-22 overtime_hours IS this calculation (see its own comment
    -- above). The block header's original framing (added alongside, so as
    -- not to redefine overtime_hours "a third time") no longer applies;
    -- that redefinition is exactly what happened, deliberately.
    --
    -- Schedule facts this relies on (confirmed, not guessed): every
    -- employee's shift starts 08:30 and includes a flat 1-hour unpaid lunch
    -- baked into the raw punch span (not separately punched). Normal hours
    -- are a flat 8 PAID hours company-wide -- NOT derived from
    -- work_locations.early_leave_time, even though 17:00 KL / 17:30 Meru
    -- are the real finish times: KL's earlier finish is company leniency,
    -- not a shorter contractual day, so both sites owe the same 8 hours.
    -- The 1-hour lunch deduction is scoped ONLY to these columns -- it does
    -- NOT change hours_worked itself (used elsewhere for attendance stats/
    -- is_insufficient_half_day_hours, out of scope to touch here).

    -- Normal daily PAID hours, company-wide: 8. No longer derived from
    -- work_locations -- see the block header above for why.
    --
    -- A duration, NOT a clock time, and nothing downstream compares it
    -- against one. Written with an explicit ::numeric cast because CREATE OR
    -- REPLACE VIEW cannot change a column's DATA TYPE any more than it can
    -- change its name (both raise 42P16), and a bare `8` would resolve to
    -- integer where this column has always been numeric.
    8::numeric
        AS normal_hours_threshold,

    -- "True" hours worked for rate-tier comparison purposes only --
    -- hours_worked's own expression minus the 1-hour lunch, floored at 0.
    GREATEST(0, GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
        AS true_hours_worked,

    -- Rest-day (weekend) day-wage tier (s.60(3)): 0.5 day's wages if worked
    -- hours <= half normal_hours_threshold, 1 day's wages if > half but <=
    -- normal_hours_threshold (this base tier still applies even when hours
    -- exceed normal_hours_threshold -- see rest_day_excess_hours below,
    -- additive on top). NULL when not a weekend, or no work done that day.
    CASE
        WHEN NOT u.is_weekend THEN NULL
        WHEN (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1) <= 0 THEN NULL
        WHEN (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
             <= 8.0 / 2
        THEN 'half_day'
        ELSE 'full_day'
    END AS rest_day_wage_tier,

    -- Rest-day hours beyond normal_hours_threshold (s.60(3)(c)): additional
    -- 2x hourly rate, on top of the day-wage tier above.
    CASE
        WHEN NOT u.is_weekend THEN 0
        ELSE GREATEST(0,
            (GREATEST(0, COALESCE(h.hw_hours, 0) - COALESCE(ro.overlap_hours, 0)) + COALESCE(a.app_hours, 0) - 1)
            - 8
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
            - 8
        )
    END AS holiday_excess_hours,

    -- =====================================================================
    -- AXIS COLUMNS (added 2026-09-22) -- the four independent questions
    -- hr_flag used to answer with one string. Each answers exactly one
    -- question and none of them can pre-empt another, so combinations that
    -- were previously unrepresentable are now just ordinary rows.
    --
    -- All are NOT NULL by construction (every branch returns a value and the
    -- LEFT JOINs are handled explicitly), so a consumer never has to write
    -- `COALESCE(axis, 'something')` or worry about three-valued logic.
    -- =====================================================================

    -- AXIS 1 -- CALENDAR. What kind of day is this, before anyone did
    -- anything? Per-employee, because public holidays are scoped to a work
    -- location (daily_holiday above already resolves at most one holiday per
    -- employee-day, preferring a location-specific row over a company-wide
    -- one).
    --
    -- 'weekend_public_holiday' makes visible a case that was previously
    -- invisible and silently double-counted: a Saturday that is ALSO a
    -- public holiday contributes to BOTH is_worked_on_weekend and
    -- is_worked_on_holiday, and therefore to both the rest-day and holiday
    -- wage tiers. That double-count is intended (they are separate statutory
    -- entitlements) but was undocumented and unqueryable.
    CASE
        WHEN u.is_weekend AND dh.holiday_name IS NOT NULL THEN 'weekend_public_holiday'
        WHEN u.is_weekend THEN 'weekend'
        WHEN dh.holiday_name IS NOT NULL THEN 'public_holiday'
        ELSE 'ordinary'
    END AS day_calendar_type,

    -- The single canonical "was anyone expected to work today?" test.
    -- Replaces NINE different expressions of this idea that had drifted
    -- across the SQL and JS layers -- variously `not is_weekend`,
    -- `not is_weekend and not is_on_leave and not is_public_holiday`,
    -- `hr_flag <> 'Absent' and not is_weekend`, and (in
    -- AttendanceActivityClockin.jsx) a browser-local Mon-Fri count with no
    -- holiday awareness at all.
    --
    -- Deliberately EXCLUDES leave: being on approved leave does not stop the
    -- day from being a working day, it just explains the absence. Denominators
    -- that additionally want to net off leave should say so explicitly rather
    -- than folding it in here.
    (NOT u.is_weekend AND dh.holiday_name IS NULL) AS is_expected_working_day,

    -- AXIS 2 -- ENTITLEMENT. What leave was recorded against this day?
    -- Sourced from HR2000 via leave_ledger_entries (daily_leave sums
    -- day_fraction across the possibly-several rows for one employee-day --
    -- confirmed AM/PM half-day splits are real).
    --
    -- 'over_full_day' is the HR2000 data-entry error already surfaced as
    -- has_leave_fraction_error (a duplicate entry, or a half-day and a
    -- full-day both logged against one date). 'partial' catches every other
    -- fraction -- 0.25, 0.75 and so on -- which the current code silently
    -- ignores everywhere: is_insufficient_half_day_hours tests
    -- `= 0.5` EXACTLY, so a 0.25 or 0.75 day matches no leave branch at all
    -- and reads as an ordinary worked (or absent) day.
    CASE
        WHEN dl.leave_emp_uuid IS NULL THEN 'none'
        WHEN COALESCE(dl.leave_day_fraction_total, 0) > 1 THEN 'over_full_day'
        WHEN COALESCE(dl.leave_day_fraction_total, 0) >= 1 THEN 'full_day'
        WHEN COALESCE(dl.leave_day_fraction_total, 0) = 0.5 THEN 'half_day'
        ELSE 'partial'
    END AS leave_state,

    -- AXIS 3a -- EVIDENCE SOURCE. Where did we learn about this day?
    -- Currently unanswerable: hr_flag conflates "came from the app" with
    -- "was approved", so there is no way to ask "show me every day we only
    -- know about from a badge scan".
    --
    -- Uses the same presence tests hr_flag's own absence branch uses
    -- (hw_check_in / app_check_in), which means a day whose ONLY app
    -- activities were Rejected reads 'none' or 'hardware' here -- correct,
    -- since app_check_in is already computed over non-Rejected rows only.
    -- The rejected-ness itself is carried by approval_state below.
    CASE
        WHEN h.hw_check_in IS NOT NULL AND a.app_check_in IS NOT NULL THEN 'both'
        WHEN h.hw_check_in IS NOT NULL THEN 'hardware'
        WHEN a.app_check_in IS NOT NULL THEN 'app'
        ELSE 'none'
    END AS evidence_source,

    -- AXIS 3b -- EVIDENCE QUALITY. Is the evidence complete, independent of
    -- where it came from or whether it was approved?
    --
    -- 'single_scan_and_open_session' is the whole point of this column. A day
    -- can have BOTH defects at once, and hr_flag structurally cannot say so:
    -- its 'Missing App Check-Out' branch sits ABOVE 'Incomplete Card Scans',
    -- so whichever fires first hides the other -- and in practice neither
    -- fires, because 'Approved'/'Pending App Approval' sit above both.
    --
    -- 'complete' means "evidence exists and has no known defect", NOT "this
    -- day is fine" -- an approved full day of app work with no badge scan at
    -- all is 'complete' here, because there is nothing missing from what was
    -- recorded.
    CASE
        WHEN h.hw_check_in IS NULL AND a.app_check_in IS NULL THEN 'none'
        WHEN COALESCE(h.total_hw_scans, 0) = 1 AND COALESCE(a.has_missing_app_checkout, false)
            THEN 'single_scan_and_open_session'
        WHEN COALESCE(h.total_hw_scans, 0) = 1 THEN 'single_scan'
        WHEN COALESCE(a.has_missing_app_checkout, false) THEN 'open_session'
        ELSE 'complete'
    END AS evidence_quality,

    -- AXIS 4 -- APPROVAL. App activities only; hardware scans are facts, not
    -- claims, so they are 'not_applicable' rather than implicitly approved.
    --
    -- Independent of evidence_quality, which is what finally makes "approved
    -- but still clocked in" expressible.
    --
    -- DELIBERATELY DIFFERS FROM hr_flag on one case, and this is a finding
    -- rather than a regression. hr_flag's 'Approved' branch tests
    -- BOOL_AND(status = 'Approved') across ALL activities, INCLUDING Rejected
    -- ones -- so a day holding one Approved activity and one Rejected
    -- activity computes all_approved = false, has_pending = false, and falls
    -- through every remaining branch to 'OK'. It reports a day with approved
    -- app work as if it had been a clean hardware-only day. This column reads
    -- the non-Rejected activities only (has_any_non_rejected / has_pending),
    -- and reports 'approved', which is what actually happened.
    --
    -- 'rejected_only' is a day whose every activity was rejected. It is not
    -- the same as 'not_applicable': something WAS claimed and refused, which
    -- is worth being able to find. Such a day contributes no hours and no
    -- app_check_in, so it reads as Absent in hr_flag terms if there is also
    -- no hardware scan.
    CASE
        WHEN a.app_emp_uuid IS NULL THEN 'not_applicable'
        WHEN NOT COALESCE(a.has_any_non_rejected, false) THEN 'rejected_only'
        WHEN COALESCE(a.has_pending, false) THEN 'pending'
        ELSE 'approved'
    END AS approval_state

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
),

-- ===========================================================================
-- DERIVED LABEL -- day_state, in its own CTE.
--
-- It lives here rather than in the outer SELECT because the reconciliation
-- columns below TEST it (is_unacknowledged_absent, needs_reconciliation), and
-- a SELECT list cannot reference a sibling output column's alias -- this
-- view's oldest and most-repeated constraint. Computing it alongside them
-- would mean restating its entire CASE inside each one, which is precisely
-- how a derived label drifts from the facts it claims to summarise.
--
-- It cannot go inside final_rows either, for the same reason one level down:
-- the axis columns it reads (day_calendar_type, evidence_source, leave_state)
-- are themselves computed there, and would be sibling aliases.
-- ===========================================================================
day_rows AS (
    SELECT
        fr.*,
        -- =====================================================================
        -- DERIVED LABEL -- day_state. A PURE FUNCTION of the axis columns above
        -- (plus is_insufficient_half_day_hours, itself a pure function of
        -- leave fraction and hours). It holds no information of its own, so it
        -- cannot drift from the axes the way hr_flag drifted from reality.
        --
        -- This is the one column HR filters on day to day, and the replacement
        -- for hr_flag's calendar/entitlement/outcome values. hr_flag's
        -- DATA-QUALITY and APPROVAL values have no counterpart here on purpose:
        -- they are not properties of what kind of day it was, and folding them
        -- back in would recreate exactly the single-winner problem this rebuild
        -- exists to remove. A day is `worked` AND evidence_quality='single_scan'
        -- AND approval_state='pending' -- three facts, three columns, all true
        -- at once.
        --
        -- Ordering within the ordinary-day branch is significant and mirrors the
        -- existing boolean flags exactly:
        --   * over_full_day wins over leave_conflict, because a day that is both
        --     (leave summing above 1.0 AND real attendance) is first of all a
        --     data-entry error -- fix the ledger, then re-judge the conflict.
        --     Both is_leave_attendance_conflict and has_leave_fraction_error
        --     stay independently true on that row, so neither fact is lost.
        --   * insufficient_half_day reuses is_insufficient_half_day_hours rather
        --     than restating `= 0.5 AND hours < 4`, so the label and the flag
        --     can never disagree.
        --   * 'partial' leave (0.25 / 0.75 and similar) lands on
        --     on_leave_partial rather than falling through to worked/absent,
        --     which is what happens today -- those fractions currently match no
        --     leave branch anywhere and a zero-attendance 0.75 day reads as a
        --     plain red Absent.
        -- =====================================================================
        CASE fr.day_calendar_type

            WHEN 'weekend_public_holiday' THEN
                CASE WHEN fr.evidence_source <> 'none' THEN 'weekend_public_holiday_worked'
                     ELSE 'weekend_public_holiday' END

            WHEN 'weekend' THEN
                CASE WHEN fr.evidence_source <> 'none' THEN 'weekend_worked'
                     WHEN fr.leave_state <> 'none' THEN 'weekend_on_leave'
                     ELSE 'weekend' END

            WHEN 'public_holiday' THEN
                CASE WHEN fr.evidence_source <> 'none' THEN 'public_holiday_worked'
                     WHEN fr.leave_state <> 'none' THEN 'public_holiday_on_leave'
                     ELSE 'public_holiday' END

            ELSE
                CASE
                    WHEN fr.leave_state = 'over_full_day' THEN 'leave_data_error'
                    WHEN fr.leave_state = 'full_day' AND fr.evidence_source <> 'none' THEN 'leave_conflict'
                    WHEN fr.leave_state = 'full_day' THEN 'on_leave'
                    WHEN fr.leave_state = 'half_day' AND fr.is_insufficient_half_day_hours THEN 'insufficient_half_day'
                    WHEN fr.leave_state IN ('half_day', 'partial') THEN 'on_leave_partial'
                    WHEN fr.evidence_source <> 'none' THEN 'worked'
                    ELSE 'absent'
                END
        END AS day_state
    FROM final_rows fr
)

-- ===========================================================================
-- ATTENDANCE RECONCILIATION -- acknowledgement-aware flags.
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
-- runs with security_invoker = on (declared INLINE at the top of this file),
-- so attendance_reconciliation_acknowledgements' own RLS (self / manager /
-- HR / superadmin) is evaluated as the calling role, exactly the same tiers
-- each of this view's own callers already needs.
-- ===========================================================================
SELECT
    fr.*,

    (fr.day_state = 'absent' AND ack_absent.id IS NULL) AS is_unacknowledged_absent,

    (fr.is_insufficient_half_day_hours AND ack_half_day.id IS NULL)
        AS is_unacknowledged_insufficient_half_day,

    -- THE ONE INTENTIONAL BEHAVIOUR CHANGE IN THIS REBUILD: the fifth limb.
    -- Hours sitting on unapproved app activities are withheld from every
    -- payroll-eligible total on this view (approved_hours_worked and friends
    -- below), so a day carrying them genuinely is unfinished payroll work --
    -- but it was not counted as needing reconciliation, which meant Payroll
    -- Export's "Needs Reconciliation (Any)" and the three attendance lists'
    -- own filter reported different sets for the same underlying problem.
    -- Payroll Export gained this category first (client-side, period-grain);
    -- this brings the day-grain server-side filter into line so the two
    -- finally agree.
    --
    -- Unguarded by calendar, exactly like the leave_conflict and
    -- leave_fraction_error limbs beside it: these are RAW FACTS, and each
    -- consumer applies its own policy. The notification layer in particular
    -- should add `and is_expected_working_day` when it is next reviewed --
    -- as written, all five limbs can fire on a weekend or public holiday,
    -- which is why employees currently get emailed about Sundays. That is a
    -- notification-scoping decision, deliberately not made here.
    (
        (fr.day_state = 'absent' AND ack_absent.id IS NULL)
        OR fr.is_leave_attendance_conflict
        OR (fr.is_insufficient_half_day_hours AND ack_half_day.id IS NULL)
        OR fr.has_leave_fraction_error
        OR GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0)) > 0
    ) AS needs_reconciliation,

    -- ===================================================================
    -- APPROVED-ONLY PAYROLL HOURS -- see daily_app's own approved_app_hours
    -- comment for why these exist alongside, not instead of,
    -- fr.hours_worked / fr.overtime_hours / fr.holiday_hours_worked /
    -- fr.weekend_hours_worked.
    --
    -- (These used to be forced into this outer SELECT by CREATE OR REPLACE
    -- VIEW's append-only rule -- anything added inside final_rows would have
    -- landed BEFORE the reconciliation columns once flattened by fr.*, which
    -- Postgres reads as renaming a column rather than appending, 42P16. That
    -- constraint is gone now this file is a DROP + CREATE; they stay here
    -- only because they need daily_app's approved_app_hours, which
    -- final_rows does not expose as an output column.)
    -- ===================================================================

    GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0))
        AS pending_approval_hours,

    GREATEST(0, fr.hours_worked - GREATEST(0, COALESCE(a2.app_hours, 0) - COALESCE(a2.approved_app_hours, 0)))
        AS approved_hours_worked,

    -- EXACT, not an approximation. Overtime is a plain linear threshold --
    -- max(0, true_hours - 8) -- and for that shape, subtracting the pending
    -- hours OUTSIDE the threshold is algebraically identical to subtracting
    -- them INSIDE it, including at the zero clamp:
    --   max(0, (true - 8) - pending) == max(0, (true - pending) - 8)
    -- both when the inner term is positive and when either clamps to 0.
    -- So this needs no restructuring, and must NOT be "fixed" by moving the
    -- subtraction inside the threshold -- that would change nothing on the
    -- happy path and risks introducing an error at the boundary.
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

FROM day_rows fr
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

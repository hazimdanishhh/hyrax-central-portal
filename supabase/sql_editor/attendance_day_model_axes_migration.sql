-- ############################################################################
-- DEPLOYMENT STEP -- SHIP 1 of the attendance day-model rebuild.
-- Run ONCE, as the table owner, in the Supabase SQL editor. Run the WHOLE
-- file in one go: step 1 drops unified_daily_attendance CASCADE, which also
-- drops attendance_activity_audit (it joins that view), and step 2 puts it
-- back. Between those two statements the day sidebar has no data source, so
-- do not stop halfway.
--
-- Supersedes attendance_employment_act_overtime_migration.sql,
-- attendance_approved_hours_and_absence_split_migration.sql and
-- attendance_reconciliation_flags_view_migration.sql -- each of those carries
-- a FULL COPY of the old view definition, so re-running any of them after
-- this lands would silently restore hr_flag's old shape and delete every
-- column added here. All three now carry a DO-NOT-RE-RUN header.
--
-- Also supersedes enable_attendance_views_security_invoker.sql: both views
-- now declare `WITH (security_invoker = on)` INLINE, so no follow-up ALTER
-- VIEW is needed. That separation was the single most dangerous thing about
-- this change -- see the PRE-FLIGHT and VERIFY sections below.
--
-- ============================================================================
-- WHAT THIS CHANGES
-- ============================================================================
-- ADDS  six orthogonal axis columns (day_calendar_type, is_expected_working_day,
--       leave_state, evidence_source, evidence_quality, approval_state) plus a
--       derived day_state label, to unified_daily_attendance.
-- DROPS estimated_normal_day_ot_hours -- an exact duplicate of overtime_hours
--       since the s.60A redefinition, with no reader anywhere in the repo.
--       Only a DROP VIEW can remove a column at all.
-- FIXES attendance_activity_audit's holiday_events branch, which fabricated a
--       synthetic holiday row for every employee ever employed (no active-
--       bucket filter), unlike the main view's daily_holiday CTE.
-- KEEPS hr_flag byte-for-byte identical. It is a compatibility column for one
--       release so its ~34 frontend and 10 SQL consumers can migrate in
--       batches instead of one atomic deploy. A later migration drops it.
--
-- ONE INTENTIONAL BEHAVIOUR CHANGE: needs_reconciliation gains a fifth limb,
-- `pending_approval_hours > 0`. Days carrying hours on unapproved app
-- activities are now reported as needing reconciliation by the server-side
-- filter behind the three attendance lists, matching what Payroll Export's
-- own client-side "Needs Reconciliation (Any)" already counts. EXPECT MORE
-- ROWS from that filter after this deploys -- that is the fix, not a fault.
-- Nothing else about any existing column changes.
--
-- ============================================================================
-- KNOWN ISSUES THIS REBUILD DELIBERATELY DOES **NOT** FIX
--
-- Found during the pre-rebuild edge-case audit. Every one is pre-existing.
-- None is introduced here, and fixing any would break the hr_flag equality
-- gate that makes this deploy verifiable -- so they are recorded rather than
-- silently carried. Listed roughly by payroll impact.
--
-- 1. ACKNOWLEDGEMENTS RLS GAP (highest impact, smallest fix).
--    attendance_logs, attendance_activities, leave_ledger_entries and
--    employees all carry an "MGM Manager VIEW" policy
--    (mgm_hr_reports_access_fix.sql). attendance_reconciliation_
--    acknowledgements does NOT. Because this view is security_invoker, an MGM
--    manager therefore sees the attendance rows but matches zero
--    acknowledgement rows -- so EVERY acknowledged day reads
--    is_unacknowledged_absent = true and needs_reconciliation = true for them.
--    Reconciliation looks permanently undone to that role. This is a missing
--    RLS policy, not a view change; it belongs in its own migration.
--
-- 2. THE ACTIVE BUCKET INCLUDES 'Sabbatical' AND 'On Leave'.
--    expected_shifts filters employment_status.category = 'active', which
--    covers Active, Probation, On Leave and Sabbatical. Someone on extended
--    unpaid leave therefore gets an expected-shift row every working day,
--    reads 'Absent', and accrues is_unacknowledged_absent indefinitely.
--    Conversely 'Suspended' and 'Terminated Notice' are EXCLUDED, so a
--    suspended or working-notice employee vanishes from the view entirely,
--    including their real current attendance.
--
-- 3. NO join_date / end_date BOUND, AND THE VIEW IS CURRENT-STATE ONLY.
--    A new joiner accrues 'Absent' for every working day in the spine BEFORE
--    they joined (up to two years back). A leaver accrues them after their
--    last day until someone flips their status -- at which point their ENTIRE
--    history disappears from the view, so re-running a closed period's payroll
--    report silently loses them and totalWorkingDaysCount/daysAbsentCount
--    change retroactively. Already self-documented as a real unfixed bug in
--    attendance_employment_act_overtime_migration.sql.
--
-- 4. auto_clock_out() COMPARES DATES IN UTC, NOT MYT.
--    `clocked_in_at::date = now()::date` with no AT TIME ZONE. A session
--    started between 00:00 and 07:59 MYT has a UTC date of the previous day,
--    so neither sweep ever matches it and it stays open forever -- surfacing
--    here as a permanent evidence_quality = 'open_session'. A one-line fix in
--    that function, not here.
--
-- 5. MIDNIGHT-CROSSING DAYS.
--    Hardware scans bucket by MYT date, so a shift crossing midnight splits
--    into two work_dates with one scan each -- both computing hw_hours = 0.00
--    and evidence_quality = 'single_scan'. App activities anchor entirely to
--    clocked_in_at, so overnight hours all land on the clock-in date and the
--    next day's hardware overlap is never subtracted. is_early_leave compares
--    a bare ::time, so someone finishing at 00:30 reads as leaving early.
--
-- 6. is_insufficient_half_day_hours HAS NO CALENDAR GUARD.
--    It tests only `fraction = 0.5 AND hours < 4`, so half-day leave recorded
--    against a Saturday flags permanently, and unlike is_unacknowledged_absent
--    its unacknowledged counterpart has no NOT is_weekend / NOT
--    is_public_holiday guard either. Only HR can clear it, not the employee.
--    NOTE: the new day_state column does NOT have this bug -- its
--    'insufficient_half_day' value only occurs on ordinary days -- so
--    migrating consumers to day_state fixes this for free.
--
-- 7. ACKNOWLEDGEMENTS ARE VALIDATED ONLY AT WRITE TIME.
--    Nothing re-checks them afterwards. If leave is synced in (suppressing an
--    absence) and then removed again by the next full-snapshot sync, the
--    orphaned acknowledgement silently PRE-suppresses the absence that
--    returns. Also, the category FK admits all four glossary codes while the
--    acknowledge RPC permits only two, so a 'leave_conflict' row is
--    structurally valid and would be silently ignored by this view's two
--    hardcoded category joins.
--
-- 8. THE SPINE INCLUDES FUTURE PUBLIC HOLIDAYS (uncapped, unlike the activity
--    branch which stops at today), so the view emits future-dated rows with
--    overtime and wage-tier columns computed. Tolerable because they read
--    is_public_holiday rather than Absent. Only 2026 is seeded.
-- ============================================================================

-- ############################################################################
-- HOW TO RUN THIS FILE
--
-- DO NOT paste the whole file and hit Run. The Supabase SQL editor shows you
-- only the LAST statement's result, so every verification query below would
-- execute and then be thrown away unseen -- which defeats the entire point of
-- having them.
--
-- Run it as FOUR separate pastes, in this order:
--
--   SECTION A  -- pre-flight capture      (run alone, BEFORE anything else)
--   SECTION B  -- the rebuild             (run alone, whole section at once)
--   SECTION C  -- verification gates      (run ONE QUERY AT A TIME, read each)
--   SECTION D  -- cleanup                 (run alone, only once C fully passes)
--
-- Everything is live SQL. Nothing needs uncommenting. The ONE thing you may
-- want to edit is the date range in SECTION A -- it is set to a recent month
-- below; widen it if you want a bigger sample.
-- ############################################################################


-- ############################################################################
-- SECTION A -- PRE-FLIGHT. Run this ALONE and FIRST, before SECTION B.
--
-- Captures what the view returns TODAY, so the gates in SECTION C can prove
-- the rebuild did not move anything it was not supposed to move. Skipping
-- this makes Gate 2 and Gate 5 impossible to run -- they read these tables.
-- ############################################################################

-- Idempotent: safe to re-run this whole section if you widen the date range
-- or if an earlier attempt failed partway.
DROP TABLE IF EXISTS public._hr_flag_baseline;
DROP TABLE IF EXISTS public._payroll_baseline;
DROP TABLE IF EXISTS public._grants_baseline;

-- Adjust this range if you want a wider sample. It must cover dates with real
-- attendance data, and the same range is used again in Gate 0, Gate 2 and
-- Gate 5.
--
-- PREFER A RANGE THAT ENDS BEFORE TODAY. Today is still accumulating badge
-- scans (vigilance_iot ingests in ~5-minute batches), so any minutes between
-- this capture and Gate 5 can legitimately move an hours total and make the
-- parity check fail for reasons that have nothing to do with the rebuild. A
-- range ending yesterday is immune to that and tests exactly the same thing.
CREATE TABLE public._hr_flag_baseline AS
SELECT employee_uuid, work_date, hr_flag
FROM public.unified_daily_attendance
WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23';

-- The payroll numbers that must not move, captured per employee per metric.
--
-- Deliberately aggregated STRAIGHT OFF THE VIEW rather than by calling
-- get_payroll_period_summary(). Two reasons:
--
--  1. That RPC raises 42501 "requires HR/superadmin" when run here. The SQL
--     editor executes as the table owner, where auth.uid() is NULL, so the
--     guard's `where p.id = auth.uid()` matches no profile row and the check
--     fails closed. (Same root cause that forced the pg_cron notification
--     functions to fork into unguarded SECURITY DEFINER variants.)
--  2. It is the better test anyway. What this migration can break is the
--     VIEW's arithmetic; the RPC is only one presentation of it. Reading the
--     view directly tests the thing that actually changed, and catches a
--     regression in columns the RPC happens not to expose.
--
-- Stored in LONG format (employee, metric, value) via to_jsonb + jsonb_each_text
-- so Gate 5's diff can report "this employee, this metric, was X, now Y"
-- instead of making you compare two very wide rows by eye.
CREATE TABLE public._payroll_baseline AS
SELECT s.employee_uuid, kv.key AS metric, kv.value AS value
FROM (
    SELECT
        employee_uuid,
        sum(hours_worked)                     AS hours_worked,
        sum(overtime_hours)                   AS overtime_hours,
        sum(true_hours_worked)                AS true_hours_worked,
        sum(holiday_hours_worked)             AS holiday_hours_worked,
        sum(weekend_hours_worked)             AS weekend_hours_worked,
        sum(approved_hours_worked)            AS approved_hours_worked,
        sum(approved_overtime_hours)          AS approved_overtime_hours,
        sum(approved_holiday_hours_worked)    AS approved_holiday_hours_worked,
        sum(approved_weekend_hours_worked)    AS approved_weekend_hours_worked,
        sum(pending_approval_hours)           AS pending_approval_hours,
        sum(rest_day_excess_hours)            AS rest_day_excess_hours,
        sum(holiday_excess_hours)             AS holiday_excess_hours,
        sum(coalesce(leave_day_fraction, 0))       AS leave_day_fraction,
        sum(coalesce(paid_leave_day_fraction, 0))  AS paid_leave_day_fraction,
        sum(coalesce(unpaid_leave_day_fraction,0)) AS unpaid_leave_day_fraction,
        count(*)                                                   AS row_count,
        count(*) filter (where hr_flag = 'Absent')                 AS absent_days,
        count(*) filter (where hr_flag = 'Absent' and not is_weekend) AS absent_working_days,
        count(*) filter (where is_worked_on_holiday)               AS worked_on_holiday_days,
        count(*) filter (where is_worked_on_weekend)               AS worked_on_weekend_days,
        count(*) filter (where is_on_leave)                        AS on_leave_days,
        count(*) filter (where is_public_holiday)                  AS public_holiday_days,
        count(*) filter (where is_weekend)                         AS weekend_days,
        count(*) filter (where is_late_arrival)                    AS late_arrival_days,
        count(*) filter (where is_early_leave)                     AS early_leave_days,
        count(*) filter (where is_leave_attendance_conflict)       AS leave_conflict_days,
        count(*) filter (where is_insufficient_half_day_hours)     AS insufficient_half_day_days,
        count(*) filter (where has_leave_fraction_error)           AS leave_fraction_error_days,
        count(*) filter (where is_unacknowledged_absent)           AS unack_absent_days,
        count(*) filter (where is_unacknowledged_insufficient_half_day) AS unack_half_day_days,
        count(*) filter (where needs_reconciliation)               AS needs_reconciliation_days,
        count(*) filter (where rest_day_wage_tier = 'half_day')    AS rest_day_half_tier,
        count(*) filter (where rest_day_wage_tier = 'full_day')    AS rest_day_full_tier,
        count(*) filter (where holiday_wage_tier = 'full_day')     AS holiday_full_tier
    FROM public.unified_daily_attendance
    WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23'
    GROUP BY employee_uuid
) s,
LATERAL jsonb_each_text(to_jsonb(s) - 'employee_uuid') kv;

-- Current grants, so Gate 1 can confirm they came back after the recreate.
CREATE TABLE public._grants_baseline AS
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('unified_daily_attendance', 'attendance_activity_audit');

-- Confirm all three captured something. If _hr_flag_baseline is 0, your date
-- range has no data -- widen it and re-run this section.
SELECT
    (SELECT count(*) FROM public._hr_flag_baseline)                       AS hr_flag_rows,
    (SELECT count(DISTINCT employee_uuid) FROM public._payroll_baseline)  AS payroll_employees,
    (SELECT count(*) FROM public._payroll_baseline)                       AS payroll_metrics,
    (SELECT count(*) FROM public._grants_baseline)                        AS grant_rows;


-- ############################################################################
-- SECTION B -- THE REBUILD. Run this whole section at once, ALONE.
--
-- The DROP ... CASCADE in the first statement also drops
-- attendance_activity_audit (it joins this view). The second half puts it
-- back. Between the two, the day sidebar has no data source -- so do not stop
-- halfway and do not run these separately.
-- ############################################################################
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
-- hr_flag is DELIBERATELY UNCHANGED here, byte for byte. It is kept for one
-- release as a compatibility column so the ~34 frontend files and 10 SQL
-- consumers that read it can migrate in batches instead of in one atomic
-- deploy, and it is dropped in a later migration once nothing references it.
-- Its expression is NOT re-derived from the new axes, because it could not be
-- reproduced exactly: hr_flag's 'Approved' branch uses
-- BOOL_AND(status = 'Approved') across ALL activities INCLUDING Rejected ones,
-- so a day holding one Approved and one Rejected activity computes
-- all_approved = false and falls all the way through to 'OK'. approval_state
-- below deliberately does not carry that quirk (it reports 'approved', which
-- is what actually happened), so the two legitimately disagree on exactly
-- those days. That divergence is a FINDING, not a regression -- see
-- approval_state's own comment.
--
-- Consequently the deploy-time equality check on hr_flag validates the
-- PLUMBING of this rewrite (CTEs, joins, GROUP BY grain, timezone handling),
-- not the label logic -- which is still the check worth running, because a
-- broken join or a slipped timezone is exactly the kind of error a rewrite
-- this size actually produces.
-- ===========================================================================

DROP VIEW IF EXISTS public.unified_daily_attendance CASCADE;

CREATE VIEW public.unified_daily_attendance
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

    (fr.hr_flag = 'Absent' AND NOT fr.is_weekend AND NOT fr.is_public_holiday
        AND ack_absent.id IS NULL) AS is_unacknowledged_absent,

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
        (fr.hr_flag = 'Absent' AND NOT fr.is_weekend AND NOT fr.is_public_holiday
            AND ack_absent.id IS NULL)
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
    END AS approved_weekend_hours_worked,

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
-- attendance_activity_audit -- one row per individual event (app activity,
-- hardware scan, leave entry, public holiday) behind a given employee-day.
-- Powers the day sidebar's Activity Timeline (fetchEmployeeDayDetails).
--
-- REBUILT 2026-09-22 alongside unified_daily_attendance. This view JOINS that
-- one, so `DROP VIEW public.unified_daily_attendance CASCADE` takes this view
-- with it -- meaning this file MUST run in the same script, immediately after
-- the main view is recreated, or the day sidebar breaks.
--
-- security_invoker is declared INLINE here rather than by a follow-up
-- ALTER VIEW (enable_attendance_views_security_invoker.sql, now superseded).
-- A drop/recreate that forgot that separate ALTER would silently leave this
-- view running with OWNER privileges, so the RLS on attendance_activities /
-- attendance_logs / employees would stop scoping rows -- and every page would
-- still render perfectly, with no error to notice.
-- ===========================================================================

DROP VIEW IF EXISTS public.attendance_activity_audit;

CREATE VIEW public.attendance_activity_audit
WITH (security_invoker = on) AS

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
        NULL::text AS remarks,

        -- Raw attendance_activities columns the "Edit" inline form
        -- (AttendanceTimelineCard.jsx's DataForm, via tableConfig.jsx's
        -- attendance_type_id/photo_url/notes columns) needs to actually
        -- pre-populate with the CURRENT value -- `attendance_type` above is
        -- only the joined display NAME (at.name), not the real FK id the
        -- edit form's select needs to preselect the right option, and
        -- neither photo_url nor notes existed on this view at all before.
        -- NULL on every other branch (Hardware/Leave/Holiday never feed
        -- this edit form -- App is the only editable event_source).
        aa.attendance_type_id,
        aa.photo_url,
        aa.notes,

        -- Provenance. Lets the Activity Timeline distinguish a record someone
        -- clocked in live from one HR typed in afterwards -- which matters
        -- most for the two re-added scanner-location types: a backfilled
        -- "Office" app row and a real "Office" scan row otherwise render as
        -- two identical-looking cards on the same day.
        aa.entry_method,
        aa.adjustment_reason_id

    FROM public.attendance_activities aa
    JOIN public.employees e ON aa.employee_id = e.id
    LEFT JOIN public.attendance_types at ON aa.attendance_type_id = at.id
),

-- 2. Grab all Hardware Sessions (Office/Plant) -- one summary row per
-- employee/location/day (kept this way per explicit request: HR wants to
-- see 1 Office card and 1 Blending Plant card, not a card per in/out pair
-- -- the odd/even pairing itself is instead visualized INSIDE each card,
-- see AttendanceTimelineCard.jsx's own use of AttendanceDayTimelineBar with
-- scan-derived pairs).
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
        NULL::text AS remarks,

        -- App-only edit-form fields (see app_events' own comment) -- never
        -- populated for Hardware rows, present only to keep the UNION
        -- ALL's column list positionally aligned.
        NULL::bigint AS attendance_type_id,
        NULL::text AS photo_url,
        NULL::text AS notes,

        -- Provenance columns (see app_events). Always NULL here -- only a real
        -- attendance_activities row has an entry_method.
        NULL::text AS entry_method,
        NULL::bigint AS adjustment_reason_id

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
        le.remarks,

        -- App-only edit-form fields (see app_events' own comment).
        NULL::bigint AS attendance_type_id,
        NULL::text AS photo_url,
        NULL::text AS notes,

        -- Provenance columns (see app_events). Always NULL here -- only a real
        -- attendance_activities row has an entry_method.
        NULL::text AS entry_method,
        NULL::bigint AS adjustment_reason_id

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
        NULL::text AS remarks,

        -- App-only edit-form fields (see app_events' own comment).
        NULL::bigint AS attendance_type_id,
        NULL::text AS photo_url,
        NULL::text AS notes,

        -- Provenance columns (see app_events). Always NULL here -- only a real
        -- attendance_activities row has an entry_method.
        NULL::text AS entry_method,
        NULL::bigint AS adjustment_reason_id

    FROM public.public_holidays ph
    JOIN public.employees e
        ON ph.work_location_id = e.work_location_id OR ph.work_location_id IS NULL
    -- Active-bucket filter added 2026-09-22, aligning this with
    -- hr_unified_daily_attendance_view.sql's daily_holiday CTE, which has
    -- always had it. Without it this branch fabricated a synthetic holiday row
    -- for EVERY employee who has ever worked here -- including people
    -- terminated years ago -- for every holiday on record.
    --
    -- Note this filter belongs on holiday_events and leave/app/hw_events
    -- deliberately do NOT get it: those rows exist because a real event was
    -- recorded, and an audit trail should still show what a since-departed
    -- employee actually did. Only this branch INVENTS rows from the employee
    -- roster crossed with the holiday calendar, which is why only this branch
    -- needs bounding.
    JOIN public.employment_status es
        ON es.id = e.employment_status_id AND es.category = 'active'
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
-- Explicit column list, NOT `ae.*`. This originally existed to satisfy
-- CREATE OR REPLACE VIEW's append-only rule (ae.* would have placed
-- attendance_type_id/photo_url/notes ahead of the uda.* columns, which
-- Postgres reads as renaming existing columns rather than appending). That
-- constraint is gone now this file is a DROP + CREATE, but the explicit list
-- stays on its own merits: it makes the view's contract readable at a glance,
-- and it stops a new column added to app_events from silently appearing here
-- with whatever type the UNION ALL happened to resolve it to.
SELECT
    ae.activity_id,
    ae.employee_uuid,
    ae.company_employee_code,
    ae.full_name,
    ae.work_date,
    ae.event_source,
    ae.attendance_type,
    ae.check_in_time,
    ae.check_out_time,
    ae.approval_status,
    ae.activity_audit_flag,
    ae.day_fraction,
    ae.remarks,
    uda.is_leave_attendance_conflict,
    uda.is_insufficient_half_day_hours,
    uda.has_leave_fraction_error,
    uda.is_worked_on_holiday,
    uda.holiday_hours_worked,
    ae.attendance_type_id,
    ae.photo_url,
    ae.notes,
    -- Appended last, after every pre-existing column, per this view's
    -- append-only constraint. ar.label is joined rather than re-derived so the
    -- badge text and the backfill form's picker always read the same wording
    -- from attendance_adjustment_reasons.
    ae.entry_method,
    ae.adjustment_reason_id,
    ar.label AS adjustment_reason_label
FROM all_events ae
LEFT JOIN public.unified_daily_attendance uda
    ON uda.employee_uuid = ae.employee_uuid AND uda.work_date = ae.work_date
LEFT JOIN public.attendance_adjustment_reasons ar
    ON ar.id = ae.adjustment_reason_id;

-- ############################################################################
-- SECTION C -- VERIFICATION GATES.
--
-- Run these ONE QUERY AT A TIME and actually read each result. The editor
-- only shows the last statement's output, so pasting the whole section runs
-- every check and shows you only the final one.
--
-- Gate 1 first -- it is the one whose failure has no visible symptom.
--
-- OR: run GATE 0 immediately below, which folds every zero-row check in this
-- section into ONE query returning one row per gate with PASS / FAIL. Use it
-- if you would rather paste once than twelve times. The individual queries
-- below are still worth running for anything GATE 0 reports as FAIL, because
-- they show you WHICH rows offended rather than just how many.
-- ############################################################################


-- ----------------------------------------------------------------------------
-- GATE 0 -- ALL ZERO-ROW CHECKS IN ONE RESULT.
--
-- Every gate here must read PASS. `offending_rows` is the count that should
-- have been zero.
--
-- The one thing GATE 0 CANNOT check is the in-app RLS test: log in as a plain
-- non-HR employee and confirm My Attendance shows only their own rows, and as
-- a manager that Team Attendance shows only direct reports. Run as the owner,
-- every query in this file bypasses RLS -- so a policy regression is invisible
-- from here no matter how many gates pass.
-- ----------------------------------------------------------------------------
WITH after_rows AS (
    SELECT s.employee_uuid, kv.key AS metric, kv.value AS value
    FROM (
        SELECT
            employee_uuid,
            sum(hours_worked)                     AS hours_worked,
            sum(overtime_hours)                   AS overtime_hours,
            sum(true_hours_worked)                AS true_hours_worked,
            sum(holiday_hours_worked)             AS holiday_hours_worked,
            sum(weekend_hours_worked)             AS weekend_hours_worked,
            sum(approved_hours_worked)            AS approved_hours_worked,
            sum(approved_overtime_hours)          AS approved_overtime_hours,
            sum(approved_holiday_hours_worked)    AS approved_holiday_hours_worked,
            sum(approved_weekend_hours_worked)    AS approved_weekend_hours_worked,
            sum(pending_approval_hours)           AS pending_approval_hours,
            sum(rest_day_excess_hours)            AS rest_day_excess_hours,
            sum(holiday_excess_hours)             AS holiday_excess_hours,
            sum(coalesce(leave_day_fraction, 0))       AS leave_day_fraction,
            sum(coalesce(paid_leave_day_fraction, 0))  AS paid_leave_day_fraction,
            sum(coalesce(unpaid_leave_day_fraction,0)) AS unpaid_leave_day_fraction,
            count(*)                                                   AS row_count,
            count(*) filter (where hr_flag = 'Absent')                 AS absent_days,
            count(*) filter (where hr_flag = 'Absent' and not is_weekend) AS absent_working_days,
            count(*) filter (where is_worked_on_holiday)               AS worked_on_holiday_days,
            count(*) filter (where is_worked_on_weekend)               AS worked_on_weekend_days,
            count(*) filter (where is_on_leave)                        AS on_leave_days,
            count(*) filter (where is_public_holiday)                  AS public_holiday_days,
            count(*) filter (where is_weekend)                         AS weekend_days,
            count(*) filter (where is_late_arrival)                    AS late_arrival_days,
            count(*) filter (where is_early_leave)                     AS early_leave_days,
            count(*) filter (where is_leave_attendance_conflict)       AS leave_conflict_days,
            count(*) filter (where is_insufficient_half_day_hours)     AS insufficient_half_day_days,
            count(*) filter (where has_leave_fraction_error)           AS leave_fraction_error_days,
            count(*) filter (where is_unacknowledged_absent)           AS unack_absent_days,
            count(*) filter (where is_unacknowledged_insufficient_half_day) AS unack_half_day_days,
            count(*) filter (where needs_reconciliation)               AS needs_reconciliation_days,
            count(*) filter (where rest_day_wage_tier = 'half_day')    AS rest_day_half_tier,
            count(*) filter (where rest_day_wage_tier = 'full_day')    AS rest_day_full_tier,
            count(*) filter (where holiday_wage_tier = 'full_day')     AS holiday_full_tier
        FROM public.unified_daily_attendance
        WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23'
        GROUP BY employee_uuid
    ) s,
    LATERAL jsonb_each_text(to_jsonb(s) - 'employee_uuid') kv
),
checks(sort_key, gate, offending_rows) AS (

    SELECT 1, 'G1a  security_invoker ON for both views', (
        SELECT count(*) FROM pg_class
        WHERE relname IN ('unified_daily_attendance','attendance_activity_audit')
          AND NOT COALESCE(array_to_string(reloptions,',') LIKE '%security_invoker=on%', false))

    UNION ALL SELECT 2, 'G1b  no grant lost vs baseline', (
        SELECT count(*) FROM (
            SELECT table_name, grantee, privilege_type FROM public._grants_baseline
            EXCEPT
            SELECT table_name, grantee, privilege_type
            FROM information_schema.role_table_grants
            WHERE table_name IN ('unified_daily_attendance','attendance_activity_audit')
        ) x)

    UNION ALL SELECT 3, 'G2a  hr_flag identical to baseline', (
        SELECT count(*) FROM public._hr_flag_baseline b
        JOIN public.unified_daily_attendance v
          ON v.employee_uuid = b.employee_uuid AND v.work_date = b.work_date
        WHERE b.hr_flag IS DISTINCT FROM v.hr_flag)

    UNION ALL SELECT 4, 'G2b  row count identical to baseline', (
        SELECT abs(
            (SELECT count(*) FROM public._hr_flag_baseline)
          - (SELECT count(*) FROM public.unified_daily_attendance
             WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23')))

    UNION ALL SELECT 5, 'G3a  absent only on ordinary days', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE day_state = 'absent' AND (is_public_holiday OR is_on_leave OR is_weekend))

    UNION ALL SELECT 6, 'G3b  is_expected_working_day = ordinary', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE is_expected_working_day <> (day_calendar_type = 'ordinary'))

    UNION ALL SELECT 7, 'G3c  no evidence => no defects', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE evidence_source = 'none' AND evidence_quality <> 'none')

    UNION ALL SELECT 8, 'G3d  hardware-only => no approval state', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE approval_state <> 'not_applicable' AND evidence_source = 'hardware')

    UNION ALL SELECT 9, 'G3e  unack absence only on working days', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE is_unacknowledged_absent AND NOT is_expected_working_day)

    UNION ALL SELECT 10, 'G3f  day_state agrees with half-day flag', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE (day_state = 'insufficient_half_day')
              <> (is_insufficient_half_day_hours AND is_expected_working_day))

    UNION ALL SELECT 11, 'G3g  leave_state agrees with is_on_leave', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE (leave_state <> 'none') <> is_on_leave)

    UNION ALL SELECT 12, 'G3h  day_calendar_type agrees with booleans', (
        SELECT count(*) FROM public.unified_daily_attendance
        WHERE day_calendar_type <> CASE
                WHEN is_weekend AND is_public_holiday THEN 'weekend_public_holiday'
                WHEN is_weekend THEN 'weekend'
                WHEN is_public_holiday THEN 'public_holiday'
                ELSE 'ordinary' END)

    UNION ALL SELECT 13, 'G5   payroll parity (excl. needs_reconciliation_days)', (
        SELECT count(*)
        FROM public._payroll_baseline b
        FULL JOIN after_rows a
               ON a.employee_uuid = b.employee_uuid AND a.metric = b.metric
        WHERE b.value IS DISTINCT FROM a.value
          AND COALESCE(b.metric, a.metric) <> 'needs_reconciliation_days')
)
SELECT gate,
       offending_rows,
       CASE WHEN offending_rows = 0 THEN 'PASS' ELSE '*** FAIL ***' END AS result
FROM checks
ORDER BY (offending_rows > 0) DESC, sort_key;

-- ----------------------------------------------------------------------------
-- GATE 1 -- ACCESS AND RLS. RUN THIS BEFORE ANYTHING ELSE.
--
-- security_invoker used to be applied by a SEPARATE ALTER VIEW. If it is ever
-- lost, both views silently fall back to OWNER privileges and RLS on
-- attendance_logs / employees / attendance_reconciliation_acknowledgements
-- stops scoping rows: My Attendance lists EVERY employee and Team Attendance
-- the whole company -- and both pages render perfectly, with no error anywhere.
-- This is the single most damaging way this migration can go wrong and the
-- only one that produces no symptom you would notice by accident.
--
-- Expect security_invoker=true in reloptions for BOTH rows:
SELECT relname, reloptions
FROM pg_class
WHERE relname IN ('unified_daily_attendance', 'attendance_activity_audit');

-- Grants must come back exactly as they were. No view in this repo carries an
-- explicit GRANT -- both rely on Supabase default privileges being re-acquired
-- on recreate, which is an assumption worth checking rather than trusting.
-- EXPECT ZERO ROWS. Anything here is a grant that was lost (or gained).
SELECT 'LOST' AS change, b.* FROM public._grants_baseline b
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_name = b.table_name AND g.grantee = b.grantee
      AND g.privilege_type = b.privilege_type)
UNION ALL
SELECT 'GAINED', g.table_name, g.grantee, g.privilege_type
FROM information_schema.role_table_grants g
WHERE g.table_name IN ('unified_daily_attendance', 'attendance_activity_audit')
  AND NOT EXISTS (
    SELECT 1 FROM public._grants_baseline b
    WHERE b.table_name = g.table_name AND b.grantee = g.grantee
      AND b.privilege_type = g.privilege_type);

-- THEN, IN THE APP, NOT IN SQL: log in as a plain non-HR employee and confirm
-- My Attendance shows only their own rows; log in as a manager and confirm
-- Team Attendance shows only direct reports. No query below substitutes for
-- this -- run it as the owner and RLS is bypassed regardless.


-- ----------------------------------------------------------------------------
-- GATE 2 -- hr_flag EQUALITY. Expect ZERO rows.
--
-- This validates the PLUMBING of the rewrite -- the CTEs, the join grain, the
-- GROUP BY keys, the timezone handling -- not the label logic, since hr_flag's
-- expression was carried over verbatim rather than re-derived. That is still
-- the check worth running: a broken join or a slipped timezone is exactly the
-- class of error a rewrite this size actually produces, and each would show up
-- here immediately.
SELECT b.employee_uuid, b.work_date, b.hr_flag AS was, v.hr_flag AS now
FROM public._hr_flag_baseline b
JOIN public.unified_daily_attendance v
  ON v.employee_uuid = b.employee_uuid AND v.work_date = b.work_date
WHERE b.hr_flag IS DISTINCT FROM v.hr_flag;

-- Row COUNT must also match -- the query above cannot see a row that vanished
-- entirely (a join that silently dropped rows, or the spine losing a date).
-- Expect the two numbers to be equal:
SELECT
    (SELECT count(*) FROM public._hr_flag_baseline) AS baseline_rows,
    (SELECT count(*) FROM public.unified_daily_attendance
     WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23') AS rebuilt_rows;


-- ----------------------------------------------------------------------------
-- GATE 3 -- AXIS INVARIANTS. Every one of these must return ZERO rows.
-- Each encodes a promise the axis columns make to their consumers.
-- ----------------------------------------------------------------------------

-- day_state='absent' must mean an ORDINARY day with no leave and no evidence.
-- If this returns rows, the day_state CASE's branch order is wrong and HR is
-- being shown red absences for weekends, holidays or approved leave.
SELECT employee_uuid, work_date, day_state, day_calendar_type, leave_state
FROM public.unified_daily_attendance
WHERE day_state = 'absent'
  AND (is_public_holiday OR is_on_leave OR is_weekend);

-- is_expected_working_day must be exactly "calendar says ordinary".
SELECT employee_uuid, work_date, day_calendar_type, is_expected_working_day
FROM public.unified_daily_attendance
WHERE is_expected_working_day <> (day_calendar_type = 'ordinary');

-- No evidence means no evidence defects.
SELECT employee_uuid, work_date, evidence_source, evidence_quality
FROM public.unified_daily_attendance
WHERE evidence_source = 'none' AND evidence_quality <> 'none';

-- Approval is an app concept. A hardware-only day cannot have one.
SELECT employee_uuid, work_date, evidence_source, approval_state
FROM public.unified_daily_attendance
WHERE approval_state <> 'not_applicable' AND evidence_source = 'hardware';

-- An unacknowledged absence can only exist on a day someone was expected to
-- work. (is_unacknowledged_absent already carries `NOT is_weekend AND NOT
-- is_public_holiday`, which is exactly is_expected_working_day -- this proves
-- those two definitions have not drifted apart.)
SELECT employee_uuid, work_date, day_calendar_type
FROM public.unified_daily_attendance
WHERE is_unacknowledged_absent AND NOT is_expected_working_day;

-- day_state must agree with the boolean flags it was derived from.
SELECT employee_uuid, work_date, day_state, is_insufficient_half_day_hours
FROM public.unified_daily_attendance
WHERE (day_state = 'insufficient_half_day') <> (is_insufficient_half_day_hours AND is_expected_working_day);

-- leave_state must agree with is_on_leave. NOTE: these two are computed from
-- slightly different tests -- leave_state asks "did daily_leave produce a row
-- for this employee-day", is_on_leave asks "is leave_type_codes non-null". They
-- can only disagree if a leave_ledger_types row has a NULL code, which would
-- make leave_type_codes NULL despite real leave existing. Rows here therefore
-- point at a leave_ledger_types data problem, not at the axis logic -- but it
-- is worth knowing either way, because is_on_leave drives UI today.
SELECT employee_uuid, work_date, leave_state, is_on_leave, leave_day_fraction, leave_type_codes
FROM public.unified_daily_attendance
WHERE (leave_state <> 'none') <> is_on_leave;

-- day_calendar_type must agree with the two booleans it is built from.
SELECT employee_uuid, work_date, day_calendar_type, is_weekend, is_public_holiday
FROM public.unified_daily_attendance
WHERE day_calendar_type <> CASE
        WHEN is_weekend AND is_public_holiday THEN 'weekend_public_holiday'
        WHEN is_weekend THEN 'weekend'
        WHEN is_public_holiday THEN 'public_holiday'
        ELSE 'ordinary' END;


-- ----------------------------------------------------------------------------
-- GATE 4 -- THE PREVIOUSLY-UNREACHABLE STATES. These SHOULD return rows if
-- such days exist in your data. Finding some is the proof that the rebuild
-- did what it was for; finding none only means the situation has not occurred
-- yet, so check the counts rather than treating empty as failure.
-- ----------------------------------------------------------------------------

-- Approved AND still clocked in. hr_flag can never say this: its 'Approved'
-- branch sits above 'Missing App Check-Out', so the open session is hidden.
SELECT count(*) AS approved_but_open_session
FROM public.unified_daily_attendance
WHERE approval_state = 'approved' AND evidence_quality = 'open_session';

-- One badge scan AND an app activity. hr_flag can never say this either:
-- 'Incomplete Card Scans' sits below every app branch.
SELECT count(*) AS single_scan_with_app_activity
FROM public.unified_daily_attendance
WHERE evidence_source = 'both' AND evidence_quality LIKE '%single_scan%';

-- Both defects at once -- structurally unrepresentable before.
SELECT count(*) AS both_defects
FROM public.unified_daily_attendance
WHERE evidence_quality = 'single_scan_and_open_session';

-- The known hr_flag quirk this rebuild exposes but deliberately does NOT fix:
-- one Approved plus one Rejected activity computes all_approved = false, so
-- hr_flag falls through to 'OK' and reports approved app work as a clean
-- hardware-only day. approval_state reports 'approved', correctly. Any rows
-- here are real days currently mislabelled in the UI.
SELECT employee_uuid, work_date, hr_flag, approval_state, evidence_source
FROM public.unified_daily_attendance
WHERE approval_state = 'approved' AND hr_flag = 'OK'
LIMIT 20;

-- Leave fractions that are neither 0.5 nor 1.0. These match no branch in the
-- current code at all -- a 0.75 day with no attendance reads as a plain red
-- Absent today, and now reads on_leave_partial.
SELECT employee_uuid, work_date, leave_day_fraction, leave_state, day_state
FROM public.unified_daily_attendance
WHERE leave_state = 'partial'
LIMIT 20;

-- A Saturday that is also a public holiday, worked. Contributes to BOTH the
-- rest-day and holiday wage tiers -- intended, previously undocumented.
SELECT employee_uuid, work_date, day_state, is_worked_on_weekend, is_worked_on_holiday,
       rest_day_wage_tier, holiday_wage_tier
FROM public.unified_daily_attendance
WHERE day_calendar_type = 'weekend_public_holiday' AND evidence_source <> 'none'
LIMIT 20;


-- ----------------------------------------------------------------------------
-- GATE 5 -- PAYROLL PARITY. The most important correctness check after Gate 1.
--
-- ONLY the needs_reconciliation-derived fields may move (the new pending-
-- approval limb). Every hours total, day count and wage-tier count must be
-- IDENTICAL. Anything else moving means a rewritten expression changed
-- meaning, and the rebuild is NOT safe to keep.
--
-- Recomputes the SECTION A aggregate against the rebuilt view and diffs it,
-- reporting ONE ROW PER CHANGED METRIC -- "this employee, this metric, was X,
-- now Y". FULL JOIN, so an employee or metric appearing or vanishing entirely
-- also shows up rather than being silently skipped.
--
-- >>> THE AGGREGATE BELOW MUST STAY CHARACTER-FOR-CHARACTER IDENTICAL TO THE
-- >>> ONE IN SECTION A, INCLUDING THE DATE RANGE. If you widened the range
-- >>> there, widen it here too, or every metric will appear to have changed.
--
-- EXPECT EXACTLY ONE metric to differ, and only this one:
--     needs_reconciliation_days   -- may go UP, never down
-- That is the new pending-approval limb, and it is the intended change.
--
-- ANY OTHER METRIC APPEARING HERE means a rewritten expression changed
-- meaning -- OR that the underlying data moved between SECTION A and now.
-- Those two look identical in this output, so read the next block before
-- concluding anything.
--
-- ---------------------------------------------------------------------------
-- IF G5 FAILS: LIVE-DATA DRIFT vs A REAL REGRESSION
--
-- The default date range ENDS TODAY, and today is still accumulating badge
-- scans -- vigilance_iot ingests in ~5-minute batches, and
-- auto_clock_out_app_on_scan() retroactively updates clocked_out_at. So any
-- minutes between SECTION A and this gate can legitimately move hours. That
-- is drift, not a defect. (Capturing a range that ends BEFORE today avoids it
-- entirely; worth doing if you ever re-run this.)
--
-- G2a passing is what makes the two distinguishable. If hr_flag is identical
-- for every row, then NO day changed its evidence presence and NO day changed
-- across the total_hw_scans = 1 boundary -- because hr_flag is computed from
-- exactly those things. That leaves only one way for a number to move: a day
-- that ALREADY had two or more scans got another one, widening its
-- first-to-last span.
--
-- So, with G2a green:
--
--   CONSISTENT WITH DRIFT -- hours-shaped metrics only:
--     hours_worked, true_hours_worked, overtime_hours, approved_hours_worked,
--     approved_overtime_hours, rest_day_excess_hours, holiday_excess_hours,
--     weekend/holiday hours, early_leave_days (a later last_out can clear it)
--   and the deltas should be small, and mostly upward.
--
--   NOT EXPLAINABLE BY DRIFT -- structural metrics:
--     row_count, absent_days, absent_working_days, weekend_days,
--     public_holiday_days, on_leave_days, leave_* , worked_on_*_days,
--     *_tier, insufficient_half_day_days, leave_conflict_days
--   None of these can move while hr_flag is unchanged. If ANY appears above,
--   it is a genuine regression -- stop and roll back.
-- ---------------------------------------------------------------------------
WITH after_rows AS (
    SELECT s.employee_uuid, kv.key AS metric, kv.value AS value
    FROM (
        SELECT
            employee_uuid,
            sum(hours_worked)                     AS hours_worked,
            sum(overtime_hours)                   AS overtime_hours,
            sum(true_hours_worked)                AS true_hours_worked,
            sum(holiday_hours_worked)             AS holiday_hours_worked,
            sum(weekend_hours_worked)             AS weekend_hours_worked,
            sum(approved_hours_worked)            AS approved_hours_worked,
            sum(approved_overtime_hours)          AS approved_overtime_hours,
            sum(approved_holiday_hours_worked)    AS approved_holiday_hours_worked,
            sum(approved_weekend_hours_worked)    AS approved_weekend_hours_worked,
            sum(pending_approval_hours)           AS pending_approval_hours,
            sum(rest_day_excess_hours)            AS rest_day_excess_hours,
            sum(holiday_excess_hours)             AS holiday_excess_hours,
            sum(coalesce(leave_day_fraction, 0))       AS leave_day_fraction,
            sum(coalesce(paid_leave_day_fraction, 0))  AS paid_leave_day_fraction,
            sum(coalesce(unpaid_leave_day_fraction,0)) AS unpaid_leave_day_fraction,
            count(*)                                                   AS row_count,
            count(*) filter (where hr_flag = 'Absent')                 AS absent_days,
            count(*) filter (where hr_flag = 'Absent' and not is_weekend) AS absent_working_days,
            count(*) filter (where is_worked_on_holiday)               AS worked_on_holiday_days,
            count(*) filter (where is_worked_on_weekend)               AS worked_on_weekend_days,
            count(*) filter (where is_on_leave)                        AS on_leave_days,
            count(*) filter (where is_public_holiday)                  AS public_holiday_days,
            count(*) filter (where is_weekend)                         AS weekend_days,
            count(*) filter (where is_late_arrival)                    AS late_arrival_days,
            count(*) filter (where is_early_leave)                     AS early_leave_days,
            count(*) filter (where is_leave_attendance_conflict)       AS leave_conflict_days,
            count(*) filter (where is_insufficient_half_day_hours)     AS insufficient_half_day_days,
            count(*) filter (where has_leave_fraction_error)           AS leave_fraction_error_days,
            count(*) filter (where is_unacknowledged_absent)           AS unack_absent_days,
            count(*) filter (where is_unacknowledged_insufficient_half_day) AS unack_half_day_days,
            count(*) filter (where needs_reconciliation)               AS needs_reconciliation_days,
            count(*) filter (where rest_day_wage_tier = 'half_day')    AS rest_day_half_tier,
            count(*) filter (where rest_day_wage_tier = 'full_day')    AS rest_day_full_tier,
            count(*) filter (where holiday_wage_tier = 'full_day')     AS holiday_full_tier
        FROM public.unified_daily_attendance
        WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23'
        GROUP BY employee_uuid
    ) s,
    LATERAL jsonb_each_text(to_jsonb(s) - 'employee_uuid') kv
)
SELECT
    COALESCE(b.employee_uuid, a.employee_uuid) AS employee_uuid,
    COALESCE(b.metric, a.metric)               AS metric,
    b.value                                    AS before_value,
    a.value                                    AS after_value
FROM public._payroll_baseline b
FULL JOIN after_rows a
       ON a.employee_uuid = b.employee_uuid AND a.metric = b.metric
WHERE b.value IS DISTINCT FROM a.value
ORDER BY 2, 1;
--
-- Sanity-check the one intended change -- these are the rows the lists'
-- "Needs Reconciliation" filter will newly include:
SELECT count(*) AS newly_flagged_pending_approval_days
FROM public.unified_daily_attendance
WHERE pending_approval_hours > 0
  AND NOT (
        is_unacknowledged_absent
     OR is_leave_attendance_conflict
     OR is_unacknowledged_insufficient_half_day
     OR has_leave_fraction_error
  );

-- Distribution sanity -- eyeball that nothing is wildly over- or under-
-- represented (e.g. every row landing on 'absent' would mean a broken join).
SELECT day_state, count(*) FROM public.unified_daily_attendance
WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23'
GROUP BY day_state ORDER BY 2 DESC;

SELECT day_calendar_type, evidence_source, evidence_quality, approval_state, count(*)
FROM public.unified_daily_attendance
WHERE work_date >= '2026-08-01' AND work_date < '2026-09-23'
GROUP BY 1,2,3,4 ORDER BY 5 DESC;


-- ############################################################################
-- SECTION D -- CLEANUP. Run ALONE, and ONLY after every gate above has passed.
--
-- Choose D1 or D2. Do NOT simply leave the tables as they are.
--
-- These are plain tables in the `public` schema created with CREATE TABLE AS,
-- which means: exposed through PostgREST, granted to `anon`/`authenticated` by
-- Supabase's default privileges, and carrying NO RLS -- because RLS is opt-in
-- per table and CREATE TABLE AS does not enable it.
--
-- _hr_flag_baseline holds one row per employee per day with their attendance
-- status. Left as-is, any authenticated user can read the whole company's
-- attendance history straight off the REST API, bypassing every policy on
-- attendance_logs / attendance_activities / employees that normally scopes it.
-- That is a wider exposure than any table this migration touched.
-- ############################################################################

-- --- D1: KEEP THEM, SAFELY -------------------------------------------------
-- Use this while anything is still unresolved. The baselines are the only
-- record of what the view returned BEFORE the rebuild and cannot be recreated
-- once the old view is gone -- so keeping them has real value.
--
-- Enabling RLS with NO policy denies everything to anon/authenticated (owner
-- and service_role still read them), and the REVOKEs remove the API grants
-- outright. Belt and braces, deliberately: either alone would do, and this is
-- personnel data.
ALTER TABLE public._hr_flag_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._payroll_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._grants_baseline  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public._hr_flag_baseline FROM anon, authenticated;
REVOKE ALL ON public._payroll_baseline FROM anon, authenticated;
REVOKE ALL ON public._grants_baseline  FROM anon, authenticated;

-- Confirm: rowsecurity must be true, and no anon/authenticated grants left.
SELECT c.relname, c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM information_schema.role_table_grants g
        WHERE g.table_name = c.relname AND g.grantee IN ('anon','authenticated')) AS api_grants
FROM pg_class c
WHERE c.relname IN ('_hr_flag_baseline','_payroll_baseline','_grants_baseline');


-- --- D2: DROP THEM ---------------------------------------------------------
-- Run this instead, once Ship 2 is done and you no longer need the before-
-- picture. Safe to run after D1.
-- DROP TABLE IF EXISTS public._hr_flag_baseline;
-- DROP TABLE IF EXISTS public._payroll_baseline;
-- DROP TABLE IF EXISTS public._grants_baseline;


-- ############################################################################
-- ROLLBACK
--
-- git show HEAD~1:supabase/sql_editor/hr_unified_daily_attendance_view.sql
-- git show HEAD~1:supabase/sql_editor/hr_attendance_activity_audit_view.sql
--
-- Run those two (the first is a CREATE OR REPLACE, so DROP ... CASCADE it
-- first), THEN enable_attendance_views_security_invoker.sql -- the old
-- definitions do NOT declare security_invoker inline, so skipping that last
-- step reintroduces exactly the RLS hole Gate 1 checks for.
-- ############################################################################

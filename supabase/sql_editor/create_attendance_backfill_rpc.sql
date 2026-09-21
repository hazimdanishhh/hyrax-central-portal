-- create_attendance_backfill: the write path behind "Backfill Attendance"
-- (HR Attendance Management), "Fix My Attendance" (My Attendance) and the
-- Team Attendance equivalent.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 8 -- requires
-- steps 1 (attendance_adjustment_reasons), 2 (entry_method columns) and 6
-- (the notification rule seed) to have run first. Step 5 (the clocked-in
-- trigger guard) MUST also already be deployed, or the very first backfill
-- will send every affected employee one bogus "You are now clocked in"
-- notification per day created.
--
-- WHY THIS EXISTS
--
-- Payroll Export already tells HR which employee-days need reconciling, and
-- already emails the employee about them. But nothing in the app could
-- actually RECORD the answer: My Attendance was view-only, and HR's "Add
-- Attendance" form had no date or time fields at all (it relied on
-- clocked_in_at DEFAULT now() and left clocked_out_at null, so it could only
-- ever create a still-open session dated today). This closes that loop.
--
-- p_rows: jsonb array of
--   { employee_id, work_date, clock_in_time, clock_out_time, day_shape,
--     attendance_type_id, adjustment_reason_id, notes }
-- with work_date as 'YYYY-MM-DD' and the two times as 'HH:MM' strings.
--
-- day_shape ('full' | 'am_half' | 'pm_half') is the alternative to supplying
-- times: send it and the server derives them from the employee's own work
-- location (see step 3b). A whole-day attendance type -- a business trip,
-- attendance_types.is_full_day -- always derives regardless, since hours are
-- meaningless for a flat daily allowance. Either route always yields a non-null
-- clocked_out_at.
--
-- The CLIENT NEVER SUPPLIES entry_method, created_by, approval_status,
-- approved_by or approved_at. All five are derived here from auth.uid(), so a
-- crafted request cannot self-approve or misattribute a record.
--
-- Two-phase validation, the same deliberate asymmetry
-- sync_leave_ledger_rpc.sql documents:
--   - STRUCTURAL errors reject the whole batch and write nothing. These mean
--     "the request is malformed or the caller isn't allowed to do this" -- not
--     a normal data situation.
--   - SKIPPABLE conditions drop one row and report it. These are expected
--     real-world cases (that day already has attendance; that day is on
--     leave).
--
-- Three response shapes, mirroring sync_leave_ledger_from_snapshot:
--   p_dry_run = true  -> status 'preview'  (nothing written)
--   p_dry_run = false -> status 'applied'
--   structural failure -> Postgres exception with a JSON `detail` array
--
-- Unlike that function, the preview returns a PER-ROW decision table rather
-- than aggregate counts: the caller is choosing N employees x M dates and
-- needs to see each cell's outcome before committing, not three numbers.
create or replace function public.create_attendance_backfill(
    p_rows                 jsonb,
    p_dry_run              boolean default false,
    p_allow_leave_conflict boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_employee_id uuid;
    v_is_superadmin     boolean;
    v_is_hr             boolean;
    v_today_myt         date;
    v_rejected_rows     jsonb;
    v_rows_out          jsonb;
    v_added_count       integer := 0;
    v_skipped_count     integer := 0;
    v_total_hours       numeric := 0;
    v_employee          record;
    v_employee_profile  uuid;
    v_employee_name     text;
    v_day_count         integer;
    v_min_date          date;
    v_max_date          date;
    v_actor_name        text;
begin
    -- ---------------------------------------------------------------------
    -- 1. Caller identity. No blanket authorization gate here -- permission is
    --    evaluated PER ROW in step 4, because one batch can legitimately mix
    --    scopes (an HR person is also somebody's manager, and is also an
    --    employee with their own days to fix).
    -- ---------------------------------------------------------------------
    v_actor_employee_id := (
        select id from public.employees where profile_id = auth.uid()
    );

    if v_actor_employee_id is null then
        raise exception 'No employee record is linked to your account'
            using hint = 'An employee row with profile_id = your auth user id must exist before you can record attendance.';
    end if;

    v_is_superadmin := public.is_superadmin();
    v_is_hr := exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    );

    -- MYT, not current_date: the database runs in UTC, so between 00:00 and
    -- 08:00 MYT current_date is still yesterday locally and would mis-classify
    -- a same-day record as being in the past/future.
    v_today_myt := (now() at time zone 'Asia/Kuala_Lumpur')::date;

    if p_rows is null or jsonb_typeof(p_rows) <> 'array'
       or jsonb_array_length(p_rows) = 0 then
        raise exception 'p_rows must be a non-empty jsonb array of attendance rows';
    end if;

    -- ---------------------------------------------------------------------
    -- 2. Parse.
    -- ---------------------------------------------------------------------
    create temporary table _parsed on commit drop as
    select
        ord::integer                                  as src_ordinal,
        nullif(trim(r->>'employee_id'), '')           as employee_id_raw,
        nullif(trim(r->>'work_date'), '')             as work_date_raw,
        nullif(trim(r->>'clock_in_time'), '')         as clock_in_raw,
        nullif(trim(r->>'clock_out_time'), '')        as clock_out_raw,
        nullif(trim(r->>'attendance_type_id'), '')    as attendance_type_raw,
        nullif(trim(r->>'adjustment_reason_id'), '')  as adjustment_reason_raw,
        -- 'full' | 'am_half' | 'pm_half'. When present, the clock times are
        -- DERIVED from it plus the employee's work location rather than taken
        -- from the payload -- which is what lets a whole-day attendance type
        -- (a business trip) be recorded without the UI ever asking for times.
        nullif(trim(r->>'day_shape'), '')             as day_shape_raw,
        nullif(r->>'notes', '')                       as notes
    from jsonb_array_elements(p_rows) with ordinality as t(r, ord);

    -- ---------------------------------------------------------------------
    -- 3. Structural validation.
    -- ---------------------------------------------------------------------
    create temporary table _validated on commit drop as
    select
        p.*,
        case
            when p.employee_id_raw is null then 'missing_employee_id'
            when p.employee_id_raw !~ '^[0-9a-fA-F-]{36}$' then 'invalid_employee_id_format'
            when p.work_date_raw is null or p.work_date_raw !~ '^\d{4}-\d{2}-\d{2}$'
                then 'invalid_work_date_format'

            -- BOTH times are mandatory, and this is the single most important
            -- rule in this function. A row with a null clocked_out_at is an
            -- OPEN session, and an open session:
            --   (a) is force-closed to now() by auto_clock_out()'s 17:00/23:59
            --       pg_cron sweeps, silently overwriting the intended time; and
            --   (b) breaks AttendanceProvider's .maybeSingle() "am I clocked
            --       in" query the moment the employee has a second open row --
            --       PostgREST returns PGRST116, the catch sets currentActivity
            --       to null, the widget says "not clocked in" while they are,
            --       and the Clock In button then creates yet another open row.
            --       That compounds permanently and is not self-healing.
            when p.day_shape_raw is not null
                 and p.day_shape_raw not in ('full', 'am_half', 'pm_half')
                then 'invalid_day_shape'
            -- Times are only required when no shape was supplied to derive
            -- them from. Either route still ALWAYS produces a non-null
            -- clocked_out_at, which is the invariant that matters.
            when p.clock_in_raw is null and p.day_shape_raw is null
                then 'missing_clock_in_time'
            when p.clock_out_raw is null and p.day_shape_raw is null
                then 'missing_clock_out_time'
            when p.clock_in_raw is not null and p.clock_in_raw !~ '^\d{2}:\d{2}$'
                then 'invalid_clock_in_format'
            when p.clock_out_raw is not null and p.clock_out_raw !~ '^\d{2}:\d{2}$'
                then 'invalid_clock_out_format'

            -- Also forecloses the midnight-spanning case, which this app's
            -- single work_date anchor genuinely cannot represent (a known,
            -- documented limitation of the Edit Clock Out form too).
            when p.clock_in_raw is not null and p.clock_out_raw is not null
                 and p.clock_out_raw <= p.clock_in_raw
                then 'clock_out_not_after_clock_in'

            -- Future dates ARE allowed (pre-recording an approved business
            -- trip is a real use case, and active_company_dates now caps its
            -- activity branch at today so a future row cannot fabricate
            -- company-wide Absent rows). Bounded at +1 year purely to catch a
            -- mistyped year -- matches the spine's own forward horizon.
            when p.work_date_raw::date > v_today_myt + interval '1 year'
                then 'work_date_too_far_in_future'

            -- Format-check before casting. These arrive from a select
            -- dropdown in the app, but this is a public PostgREST surface --
            -- a non-numeric value would otherwise raise a raw
            -- "invalid input syntax for type bigint" instead of a named,
            -- reportable validation failure.
            when p.attendance_type_raw is null then 'missing_attendance_type_id'
            when p.attendance_type_raw !~ '^\d+$' then 'invalid_attendance_type_id'
            when not exists (
                select 1 from public.attendance_types at
                where at.id = p.attendance_type_raw::bigint
            ) then 'unrecognized_attendance_type_id'

            when p.adjustment_reason_raw is null then 'missing_adjustment_reason_id'
            when p.adjustment_reason_raw !~ '^\d+$' then 'invalid_adjustment_reason_id'
            when not exists (
                select 1 from public.attendance_adjustment_reasons ar
                where ar.id = p.adjustment_reason_raw::bigint and ar.is_active
            ) then 'unrecognized_adjustment_reason_id'

            -- requires_notes is enforced here, not only in the form: the
            -- client-side column config can express "always required" but not
            -- "required only when reason = other".
            when exists (
                select 1 from public.attendance_adjustment_reasons ar
                where ar.id = p.adjustment_reason_raw::bigint
                  and ar.requires_notes
            ) and p.notes is null then 'notes_required_for_this_reason'

            when not exists (
                select 1
                from public.employees e
                join public.employment_status es on es.id = e.employment_status_id
                where e.id = p.employee_id_raw::uuid and es.category = 'active'
            ) then 'employee_not_found_or_inactive'

            -- Authorization, evaluated per row. Mirrors approve_attendance.sql's
            -- three branches verbatim (superadmin / HR department 7 / the
            -- employee's direct manager) plus a fourth self branch, so the two
            -- functions cannot drift apart on who may touch whose attendance.
            --
            -- Structural, NOT skippable: silently dropping a row the caller
            -- isn't entitled to would hide a privilege mistake rather than
            -- surface it.
            when not (
                v_is_superadmin
                or v_is_hr
                or p.employee_id_raw::uuid = v_actor_employee_id
                or exists (
                    select 1 from public.employees e
                    where e.id = p.employee_id_raw::uuid
                      and e.manager_id = v_actor_employee_id
                )
            ) then 'not_authorized_for_this_employee'

            else null
        end as structural_error
    from _parsed p;

    select jsonb_agg(jsonb_build_object(
               'src_ordinal', src_ordinal,
               'employee_id', employee_id_raw,
               'work_date', work_date_raw,
               'clock_in_time', clock_in_raw,
               'clock_out_time', clock_out_raw,
               'reason', structural_error
           ) order by src_ordinal)
    into v_rejected_rows
    from _validated
    where structural_error is not null;

    if v_rejected_rows is not null then
        raise exception 'Attendance backfill rejected: % row(s) failed validation -- nothing was written',
            jsonb_array_length(v_rejected_rows)
            using detail = v_rejected_rows::text,
                  hint   = 'error.details is a JSON array of {src_ordinal, employee_id, work_date, clock_in_time, clock_out_time, reason}.';
    end if;

    -- Duplicate (employee, date) within one submitted batch. Cannot happen
    -- from the wizard's own employee x date matrix, but per-cell editing on
    -- the preview step could produce it, and two rows for one day is the
    -- double-counting bug this function exists to prevent.
    select jsonb_agg(jsonb_build_object(
               'employee_id', employee_id_raw,
               'work_date', work_date_raw,
               'reason', 'duplicate_employee_date_in_batch'
           ))
    into v_rejected_rows
    from (
        select employee_id_raw, work_date_raw
        from _validated
        group by employee_id_raw, work_date_raw
        having count(*) > 1
    ) d;

    if v_rejected_rows is not null then
        raise exception 'Attendance backfill rejected: the same employee/date appears more than once -- nothing was written'
            using detail = v_rejected_rows::text;
    end if;

    -- ---------------------------------------------------------------------
    -- 3b. Resolve the effective clock times.
    -- ---------------------------------------------------------------------
    -- A whole-day type (attendance_types.is_full_day -- the business trips)
    -- ALWAYS derives, because its allowance is a flat daily entitlement and
    -- hours would only manufacture overtime against the figure the claims
    -- layer reconciles against. A timed type derives only when the caller sent
    -- a shape instead of times.
    --
    -- Either way both times end up non-null, which is the invariant that
    -- matters: a null clocked_out_at is an open session, and an open session
    -- gets force-closed by auto_clock_out() and breaks AttendanceProvider's
    -- .maybeSingle() the moment a second one exists.
    create temporary table _timed on commit drop as
    select
        v.*,
        case
            when v.day_shape_raw = 'pm_half' then '13:00'
            when v.day_shape_raw is not null or at.is_full_day then '08:30'
            else v.clock_in_raw
        end as effective_clock_in,
        case
            when v.day_shape_raw = 'am_half' then '12:30'
            when v.day_shape_raw is not null or at.is_full_day
                then to_char(coalesce(wl.early_leave_time, time '17:00'), 'HH24:MI')
            else v.clock_out_raw
        end as effective_clock_out
    from _validated v
    join public.employees e on e.id = v.employee_id_raw::uuid
    left join public.work_locations wl on wl.id = e.work_location_id
    left join public.attendance_types at on at.id = v.attendance_type_raw::bigint;

    -- ---------------------------------------------------------------------
    -- 4. Resolve: compose timestamps, derive provenance, decide add vs skip.
    -- ---------------------------------------------------------------------
    create temporary table _resolved on commit drop as
    select
        v.src_ordinal,
        v.employee_id_raw::uuid                as employee_id,
        v.work_date_raw::date                  as work_date,
        v.attendance_type_raw::bigint          as attendance_type_id,
        v.adjustment_reason_raw::bigint        as adjustment_reason_id,
        v.notes,

        -- The SERVER composes the timestamp, never the client. This single
        -- expression is where MYT day-bucketing is defined for written
        -- attendance, and it matches daily_app's own
        -- DATE(clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur') grouping
        -- exactly -- so a row created for a given date always lands on that
        -- date in every view, regardless of the caller's timezone.
        --
        -- WHICH TIMES: the explicit payload times win, EXCEPT for a whole-day
        -- attendance type, where they are ignored and derived from the shape.
        -- Ignoring rather than rejecting is deliberate -- rejecting would make
        -- this function's deployment order-dependent, breaking whatever
        -- frontend is live the moment it lands.
        --
        -- The 08:30 start and the 12:30/13:00 lunch boundary mirror
        -- src/components/attendance/attendanceBackfillWizard/backfillWizardUtils.js,
        -- which needs them client-side to seed the editable time inputs for
        -- TIMED types. Deliberate duplication, like payrollReconciliationLinks.js
        -- mirroring this schema's category mapping -- keep the two in step.
        ((v.work_date_raw || ' ' || v.effective_clock_in)::timestamp
            at time zone 'Asia/Kuala_Lumpur')   as clocked_in_at,
        ((v.work_date_raw || ' ' || v.effective_clock_out)::timestamp
            at time zone 'Asia/Kuala_Lumpur')   as clocked_out_at,

        -- Self wins over HR: an HR employee fixing their OWN day is doing
        -- self-reconciliation, and should go through approval like anyone
        -- else rather than silently self-approving.
        case
            when v.employee_id_raw::uuid = v_actor_employee_id
                then 'employee_reconciliation'
            when v_is_superadmin or v_is_hr then 'hr_backfill'
            else 'manager_backfill'
        end                                     as entry_method,

        -- Skip reasons, in precedence order.
        case
            -- Overlapping an existing activity is the hard double-count
            -- guard and has NO override. daily_app SUMs hours across every
            -- non-Rejected row for an employee-day, so two overlapping rows
            -- inflate hours_worked -> overtime_hours -> the statutory rate
            -- tiers -> the payroll handoff, with no error anywhere.
            --
            -- The 'Rejected' exclusion mirrors daily_app's own predicate
            -- exactly: a Rejected row contributes zero hours, so overlapping
            -- one is harmless and blocking it would be a false positive.
            -- coalesce(clocked_out_at, clocked_in_at) treats a still-open
            -- session as a zero-width interval at its start, so a backfill
            -- spanning an open session still correctly collides with it.
            when exists (
                select 1 from public.attendance_activities aa
                where aa.employee_id = v.employee_id_raw::uuid
                  and aa.approval_status::text <> 'Rejected'
                  and aa.clocked_in_at
                        < ((v.work_date_raw || ' ' || v.effective_clock_out)::timestamp
                            at time zone 'Asia/Kuala_Lumpur')
                  and coalesce(aa.clocked_out_at, aa.clocked_in_at)
                        > ((v.work_date_raw || ' ' || v.effective_clock_in)::timestamp
                            at time zone 'Asia/Kuala_Lumpur')
            ) then 'overlaps_existing_activity'

            -- A full day's leave is already on record. Overridable, because
            -- it IS sometimes legitimate (leave that should be withdrawn
            -- because the person actually worked) -- that is precisely what
            -- unified_daily_attendance.is_leave_attendance_conflict exists to
            -- surface. Default is to skip, so a bulk sweep doesn't
            -- manufacture conflict flags at scale.
            when not p_allow_leave_conflict and exists (
                select 1 from public.leave_ledger_entries le
                where le.employee_id = v.employee_id_raw::uuid
                  and le.leave_date = v.work_date_raw::date
                group by le.employee_id, le.leave_date
                having sum(le.day_fraction) >= 1
            ) then 'full_day_leave_on_record'

            else null
        end                                     as skip_reason
    from _timed v;

    -- ---------------------------------------------------------------------
    -- 5. Build the per-row decision table returned by both preview and apply.
    -- ---------------------------------------------------------------------
    select
        jsonb_agg(jsonb_build_object(
            'employeeId',          r.employee_id,
            'fullName',            e.full_name,
            'workDate',            r.work_date,
            'clockInAt',           r.clocked_in_at,
            'clockOutAt',          r.clocked_out_at,
            -- Explicit ::numeric before round(), matching
            -- hr_unified_daily_attendance_view.sql's own app_hours expression:
            -- round(x, 2) has no double-precision overload, so relying on
            -- extract()'s return type is a portability trap.
            'hours',               round(
                                       (extract(epoch from (r.clocked_out_at - r.clocked_in_at))
                                        / 3600)::numeric, 2),
            'attendanceTypeName',  at.name,
            'adjustmentReason',    ar.label,
            'entryMethod',         r.entry_method,
            'action',              case when r.skip_reason is null then 'add' else 'skip' end,
            'reason',              r.skip_reason,
            -- Warnings do NOT block the insert; they exist so the person
            -- committing can see that the row has a payroll consequence
            -- beyond simply filling a gap.
            --
            -- Built by concatenating jsonb arrays rather than UNION ALL over a
            -- derived table: a FROM-clause subquery would need LATERAL to see
            -- r/e here, and `jsonb || jsonb` concatenating two arrays is both
            -- simpler and unambiguous.
            'warnings',
                -- A weekend or holiday backfill feeds is_worked_on_weekend /
                -- is_worked_on_holiday and the rest-day / holiday statutory
                -- wage tiers -- i.e. it moves payroll figures in a way an
                -- ordinary weekday row does not.
                (case
                    when extract(isodow from r.work_date) in (6, 7)
                      or exists (
                          select 1 from public.public_holidays ph
                          where ph.holiday_date = r.work_date
                            and (ph.work_location_id is null
                                 or ph.work_location_id = e.work_location_id)
                      )
                    then jsonb_build_array('weekend_or_holiday')
                    else '[]'::jsonb
                end)
                ||
                -- Real scans already exist that day. The hours still compute
                -- correctly (daily_hw_remote_overlap subtracts the overlap),
                -- but it usually means the situation was misread.
                (case
                    when exists (
                        select 1 from public.attendance_logs al
                        where al.employee_id = e.employee_id
                          and date(al.scanned_at at time zone 'Asia/Kuala_Lumpur')
                              = r.work_date
                    )
                    then jsonb_build_array('has_scans_that_day')
                    else '[]'::jsonb
                end)
                ||
                (case
                    when r.work_date > v_today_myt
                    then jsonb_build_array('future_date')
                    else '[]'::jsonb
                end)
        ) order by e.full_name, r.work_date)
    into v_rows_out
    from _resolved r
    join public.employees e on e.id = r.employee_id
    join public.attendance_types at on at.id = r.attendance_type_id
    join public.attendance_adjustment_reasons ar on ar.id = r.adjustment_reason_id;

    select
        count(*) filter (where skip_reason is null),
        count(*) filter (where skip_reason is not null),
        coalesce(sum(
            case when skip_reason is null
                 then round((extract(epoch from (clocked_out_at - clocked_in_at))
                             / 3600)::numeric, 2)
                 else 0 end
        ), 0)
    into v_added_count, v_skipped_count, v_total_hours
    from _resolved;

    if p_dry_run then
        return jsonb_build_object(
            'status',          'preview',
            'wouldAddCount',   v_added_count,
            'wouldSkipCount',  v_skipped_count,
            'totalHours',      v_total_hours,
            'rows',            coalesce(v_rows_out, '[]'::jsonb)
        );
    end if;

    -- ---------------------------------------------------------------------
    -- 6. Apply.
    -- ---------------------------------------------------------------------
    -- approval_status is derived, never accepted from the client:
    --
    --   employee_reconciliation -> 'Pending'. The employee is ASSERTING time
    --     they were not observed working. That assertion is exactly what the
    --     approval step exists to have a supervisor confirm, and
    --     approve_attendance already forbids approving your own record.
    --
    --   hr_backfill / manager_backfill -> 'Approved', stamped with the actor.
    --     Whoever ran this is already an authorised approver for this employee
    --     under approve_attendance's own rules, so routing it back to
    --     themselves for a click is a null control -- and leaving it Pending
    --     would flip hr_flag to 'Pending App Approval' on the very day HR just
    --     corrected, then have check_attendance_approvals_pending nag about a
    --     queue of hundreds of rows, which pushes HR toward blind bulk
    --     approval. created_by and approved_by are both recorded, so the audit
    --     trail shows plainly that the same person did both.
    --
    -- approve_attendance / reject_attendance are NOT modified by any of this;
    -- approval_status is simply set as a field at insert time.
    insert into public.attendance_activities (
        employee_id, attendance_type_id, clocked_in_at, clocked_out_at,
        notes, entry_method, adjustment_reason_id, created_by,
        approval_status, approved_by, approved_at
    )
    select
        r.employee_id,
        r.attendance_type_id,
        r.clocked_in_at,
        r.clocked_out_at,
        r.notes,
        r.entry_method,
        r.adjustment_reason_id,
        v_actor_employee_id,
        (case when r.entry_method = 'employee_reconciliation'
              then 'Pending' else 'Approved' end)::public.attendance_approval_status,
        case when r.entry_method = 'employee_reconciliation'
             then null else v_actor_employee_id end,
        case when r.entry_method = 'employee_reconciliation'
             then null else now() end
    from _resolved r
    where r.skip_reason is null;

    -- ---------------------------------------------------------------------
    -- 7. Notify, ONE notification per affected employee -- not one per row.
    -- ---------------------------------------------------------------------
    -- Deliberately emitted here rather than from an AFTER INSERT trigger. A
    -- row trigger physically cannot aggregate: backfilling ten days for one
    -- person would fire ten times. This is the one place in this schema where
    -- breaking the trigger convention is the correct call, and the reason is
    -- exactly that aggregation requirement.
    --
    -- Self-reconciliation intentionally emits NOTHING here: that row lands
    -- Pending, and the existing check_attendance_approvals_pending scheduled
    -- scan plus its seeded rule already notify HR and the manager. A second
    -- mechanism for the same fact would only be able to disagree with the
    -- first one.
    select full_name into v_actor_name
    from public.employees where id = v_actor_employee_id;

    for v_employee in
        select r.employee_id, count(*) as day_count,
               min(r.work_date) as min_date, max(r.work_date) as max_date
        from _resolved r
        where r.skip_reason is null
          and r.entry_method <> 'employee_reconciliation'
        group by r.employee_id
    loop
        select e.profile_id, e.full_name
        into v_employee_profile, v_employee_name
        from public.employees e where e.id = v_employee.employee_id;

        -- No linked portal account -- nobody to notify. HR's weekly
        -- reconciliation digest already counts these people separately.
        continue when v_employee_profile is null;

        v_day_count := v_employee.day_count;
        v_min_date := v_employee.min_date;
        v_max_date := v_employee.max_date;

        -- A notification failure must never roll back the attendance it is
        -- reporting on -- same convention notify_attendance_clocked_in() and
        -- notify_task_assigned() already follow.
        begin
            perform public.emit_notification_event(
                'attendance.backfilled',
                'attendance_activities',
                v_employee.employee_id::text,
                jsonb_build_object(
                    'employee_id', v_employee.employee_id,
                    'employee_profile_id', v_employee_profile,
                    'day_count', v_day_count,
                    'title', 'Attendance Records Added',
                    'message', format(
                        '%s attendance record(s) were added to your timesheet for %s%s by %s. Please review them and let HR know if anything looks wrong.',
                        v_day_count,
                        to_char(v_min_date, 'DD Mon YYYY'),
                        case when v_max_date <> v_min_date
                             then ' to ' || to_char(v_max_date, 'DD Mon YYYY')
                             else '' end,
                        coalesce(v_actor_name, 'HR')
                    ),
                    'link_to', '/app/employee/attendance/list'
                )
            );
        exception when others then
            raise warning 'attendance.backfilled notification failed for employee %: %',
                v_employee.employee_id, sqlerrm;
        end;
    end loop;

    return jsonb_build_object(
        'status',       'applied',
        'addedCount',   v_added_count,
        'skippedCount', v_skipped_count,
        'totalHours',   v_total_hours,
        'rows',         coalesce(v_rows_out, '[]'::jsonb)
    );
end;
$$;

grant execute on function public.create_attendance_backfill(jsonb, boolean, boolean)
    to authenticated;

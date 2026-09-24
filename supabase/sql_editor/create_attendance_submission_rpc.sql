-- create_attendance_submission: record ONE attendance submission -- one
-- employee, one attendance type, one reason, one photo, one note -- across a
-- set of dates, each with its own day shape and times.
--
-- Run this once in the Supabase SQL editor. Re-runnable (CREATE OR REPLACE).
--
-- ===========================================================================
-- WHY A SECOND FUNCTION RATHER THAN EXTENDING create_attendance_backfill
-- ===========================================================================
-- Deliberate, and the deployment is deliberately reversible: this is additive
-- only. create_attendance_backfill is untouched and still live -- the
-- Backfill wizard and the sidebar's original AddActivityForm both still exist
-- as files and still work if their mount points are swapped back. As of
-- 2026-09-24 this function is what actually RUNS behind three of the four
-- "add attendance" entry points (HR/My/Team Attendance's own button, and the
-- day sidebar's "Add Activity"/"Report Missing Activity"), via
-- AttendanceSubmissionForm's lockDate mode for the sidebar case -- but backing
-- any one of them out is still a one-line component swap in the UI, no SQL to
-- undo.
--
-- ===========================================================================
-- CALENDAR-CONTEXT WARNINGS ARE NOT DUPLICATED HERE -- SEE
-- get_attendance_backfill_prefill_rpc.sql
-- ===========================================================================
-- AttendanceSubmissionForm's per-date tags (Weekend / Public Holiday /
-- On leave / Has attendance / Not in attendance calendar) come from a
-- SEPARATE, pre-existing, read-only RPC -- get_attendance_backfill_prefill --
-- called directly from the client before this function ever runs, not from
-- anything returned here.
--
-- Deliberately not inlined into this function's own return value: it is
-- read-only information the user needs WHILE STILL EDITING the form, before
-- deciding whether to save at all, whereas this function only runs once, on
-- submit. Duplicating that logic into a write RPC would mean recomputing it on
-- every keystroke just to show a warning, or adding a dry-run mode this
-- function does not otherwise need.
--
-- That RPC's own header now documents this as a second consumer, precisely so
-- retiring create_attendance_backfill and its wizard does not accidentally
-- take get_attendance_backfill_prefill down with them -- this function's
-- client-side caller depends on it directly and would silently lose its
-- calendar warnings if it were removed.
--
-- The two also model genuinely different acts:
--
--   create_attendance_backfill  -- N employees x N dates, each row independent,
--                                  built for HR reconciling a gap in bulk.
--   create_attendance_submission -- ONE employee, ONE reason, ONE piece of
--                                  evidence, spread over a date range.
--
-- The second is what an employee recording a four-day business trip actually
-- does. Under the first they would attach their evidence four times, or (as
-- happens today) not at all -- the bulk wizard has no concept of a photo.
--
-- ===========================================================================
-- CONTRACT
-- ===========================================================================
-- p_employee_id          uuid   -- exactly one
-- p_attendance_type_id   bigint -- one, for every row
-- p_days                 jsonb  -- [{ work_date, day_shape, clock_in_time,
--                                    clock_out_time }, ...]
-- p_notes                text   -- one, for every row (nullable)
-- p_photo_url            text   -- one, for every row (nullable)
-- p_photo_path           text   -- the storage object behind p_photo_url
-- p_allow_leave_conflict boolean
-- p_adjustment_reason_id bigint -- nullable; see REASON REQUIREMENT below.
--                                  Last in the parameter list (rather than
--                                  next to p_attendance_type_id, where it
--                                  reads more naturally) because it is the
--                                  only nullable param besides the ones that
--                                  already default -- Postgres requires every
--                                  parameter after the first defaulted one to
--                                  also have a default, and p_days can't.
--
-- work_date is 'YYYY-MM-DD'; the two times are 'HH:MM'. day_shape is
-- 'full' | 'am_half' | 'pm_half'.
--
-- ===========================================================================
-- REASON REQUIREMENT AND SCANNER-ONLY TYPES (added 2026-09-24)
-- ===========================================================================
-- p_adjustment_reason_id is required unless every date in p_days is strictly
-- after today (Asia/Kuala_Lumpur): a past or current-day entry is asserting
-- something happened and needs a reason, a future date is just a plan. Also
-- enforced client-side (AttendanceSubmissionForm.jsx) so the UI's own
-- required-field marker agrees with this.
--
-- Separately, a type with is_self_selectable = false (Office, Blending
-- Plant) can never be submitted for a future date, regardless of reason --
-- those types exist only to reconcile a failed scanner day, never to
-- pre-declare one.
--
-- ONE STORAGE OBJECT, N REFERENCES. Every created row carries the same
-- photo_url/photo_path. That is the honest shape for "one piece of evidence
-- covering four days" without inventing a submission entity, and it means
-- deleting one day's row cannot strand the others' evidence.
--
-- THE CLIENT NEVER SUPPLIES entry_method, created_by, approval_status,
-- approved_by or approved_at -- all five are derived here from auth.uid(), so
-- a crafted request cannot self-approve or misattribute a record. Same rule
-- create_attendance_backfill states, and for the same reason.
--
-- RETURNS the created activity ids, which create_attendance_backfill does not.
-- That is not cosmetic: without ids there is no way to attach anything to a
-- row after the fact, which is exactly what blocked adding a photo to the
-- bulk path. When attendance documents land as a child table, they hang off
-- these.
--
-- security definer + set search_path = '' + fully-qualified public.* names:
-- the same hardening every other SECURITY DEFINER function in this schema uses.
--
-- p_adjustment_reason_id moved to the end of the parameter list (2026-09-24,
-- to make it nullable) -- a reordered signature is a new overload as far as
-- Postgres is concerned, so this drops the old 8-arg signature explicitly
-- rather than relying on CREATE OR REPLACE, which would otherwise leave it
-- behind as an orphaned overload.
--
-- BOTH possible signatures are dropped, so this file stays re-runnable no
-- matter how many times it's been applied: the pre-reorder signature (reason
-- 3rd) on a first run, or this file's own post-reorder signature (reason
-- last) on any run after that -- a plain `create function` against a
-- signature that already exists (e.g. from a previous run of this same file)
-- fails with 42723 otherwise.
drop function if exists public.create_attendance_submission(
    uuid, bigint, bigint, jsonb, text, text, text, boolean
);
drop function if exists public.create_attendance_submission(
    uuid, bigint, jsonb, text, text, text, boolean, bigint
);

create function public.create_attendance_submission(
    p_employee_id          uuid,
    p_attendance_type_id   bigint,
    p_days                 jsonb,
    p_notes                text default null,
    p_photo_url            text default null,
    p_photo_path           text default null,
    p_allow_leave_conflict boolean default false,
    p_adjustment_reason_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_employee_id uuid;
    v_is_superadmin     boolean;
    v_is_hr             boolean;
    v_is_manager        boolean;
    v_is_self           boolean;
    v_entry_method      text;
    v_approval          text;
    v_type              public.attendance_types;
    v_reason            public.attendance_adjustment_reasons;
    v_shift_end         time;
    v_added             jsonb;
    v_skipped           jsonb;
    v_today_myt         date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
    -- -----------------------------------------------------------------------
    -- 1. Who is asking, and may they write for this employee?
    -- -----------------------------------------------------------------------
    select id into v_actor_employee_id
    from public.employees where profile_id = auth.uid() limit 1;

    if v_actor_employee_id is null then
        raise exception 'No employee record is linked to your account';
    end if;

    v_is_superadmin := public.is_superadmin();
    v_is_self       := (p_employee_id = v_actor_employee_id);
    v_is_hr := exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    );
    v_is_manager := exists (
        select 1 from public.employees e
        where e.id = p_employee_id and e.manager_id = v_actor_employee_id
    );

    if not (v_is_superadmin or v_is_hr or v_is_manager or v_is_self) then
        raise exception 'Not authorized to record attendance for this employee';
    end if;

    -- PROVENANCE, derived here and never accepted from the client.
    --
    -- An employee recording their OWN past attendance is an assertion, so it
    -- lands Pending for someone else to review. Anyone else recording it is
    -- already an authorised approver for that employee, so routing it back to
    -- themselves would be a null control -- and leaving it Pending would flag
    -- the very day they just corrected.
    --
    -- Self-review is impossible by construction: v_is_self is checked FIRST,
    -- so an HR user recording their own trip still lands Pending.
    if v_is_self then
        v_entry_method := 'employee_reconciliation';
        v_approval     := 'Pending';
    else
        v_entry_method := 'hr_backfill';
        v_approval     := 'Approved';
    end if;

    -- -----------------------------------------------------------------------
    -- 2. Structural validation -- reject the whole submission, write nothing
    -- -----------------------------------------------------------------------
    -- A submission is ONE act. A partially-applied business trip is worse than
    -- a rejected one: the employee believes it is recorded, and the missing
    -- days surface weeks later as absences. Contrast create_attendance_backfill,
    -- which is per-row precisely because HR reconciling 200 rows does not want
    -- one bad date to discard the other 199.
    if p_days is null or jsonb_typeof(p_days) <> 'array'
       or jsonb_array_length(p_days) = 0 then
        raise exception 'Select at least one date';
    end if;

    if jsonb_array_length(p_days) > 62 then
        raise exception 'A single submission cannot span more than 62 days'
            using hint = 'Split it, or use Backfill Attendance for a bulk correction.';
    end if;

    select * into v_type from public.attendance_types
    where id = p_attendance_type_id;
    if not found then
        raise exception 'Unknown attendance type';
    end if;

    -- Nullable now -- see REASON REQUIREMENT above. Only validated when one
    -- is actually supplied; whether it was REQUIRED to be supplied is decided
    -- below, once the dates are known.
    if p_adjustment_reason_id is not null then
        select * into v_reason from public.attendance_adjustment_reasons
        where id = p_adjustment_reason_id and is_active;
        if not found then
            raise exception 'Unknown or inactive reason';
        end if;
    end if;

    -- Evidence requirements come from the TYPE, enforced here and not only in
    -- the form. The client config can express "always required" but not
    -- "required only for this type", which is the same reasoning
    -- create_attendance_backfill already applies to requires_notes.
    if v_type.requires_photo and coalesce(btrim(p_photo_url), '') = '' then
        raise exception '% requires a photo', v_type.name;
    end if;

    if (v_type.requires_notes or v_reason.requires_notes)
       and coalesce(btrim(p_notes), '') = '' then
        raise exception 'This attendance type or reason requires a written note';
    end if;

    -- -----------------------------------------------------------------------
    -- 3. Expand the days, deriving times where the shape decides them
    -- -----------------------------------------------------------------------
    select coalesce(wl.early_leave_time, time '17:00')
    into v_shift_end
    from public.employees e
    left join public.work_locations wl on wl.id = e.work_location_id
    where e.id = p_employee_id;

    create temporary table _days on commit drop as
    select
        (d->>'work_date')::date                          as work_date,
        coalesce(nullif(trim(d->>'day_shape'), ''), 'full') as day_shape,
        nullif(trim(d->>'clock_in_time'), '')            as clock_in_raw,
        nullif(trim(d->>'clock_out_time'), '')           as clock_out_raw
    from jsonb_array_elements(p_days) as t(d);

    if exists (select 1 from _days where day_shape not in ('full','am_half','pm_half')) then
        raise exception 'Invalid day shape';
    end if;

    if exists (select 1 from _days group by work_date having count(*) > 1) then
        raise exception 'The same date appears more than once in this submission';
    end if;

    -- REASON REQUIREMENT: required unless every date is strictly in the
    -- future. See the header comment for why.
    if p_adjustment_reason_id is null
       and exists (select 1 from _days where work_date <= v_today_myt) then
        raise exception 'A reason is required for a submission that includes today or a past date';
    end if;

    -- SCANNER-ONLY TYPES cannot be pre-declared for a future date. `= false`
    -- (not `is distinct from true`) so a type without the column populated is
    -- treated as selectable, matching attendanceActivityConfig.js's `!== false`.
    if v_type.is_self_selectable = false
       and exists (select 1 from _days where work_date > v_today_myt) then
        raise exception '% is scanner-only and cannot be recorded for a future date', v_type.name;
    end if;

    -- A whole-day type derives its own times regardless of what was sent --
    -- hours are meaningless for something paid as a flat daily allowance.
    -- Otherwise the client's times win, having already been seeded from the
    -- shape and constrained against it there.
    --
    -- Either route always yields a non-null clocked_out_at. A null one is an
    -- open session, and an open session gets force-closed by auto_clock_out()
    -- and breaks AttendanceProvider the moment a second one exists.
    create temporary table _resolved on commit drop as
    select
        d.work_date,
        d.day_shape,
        (d.work_date + (case
            when v_type.is_full_day then time '08:30'
            when d.day_shape = 'pm_half' then time '13:00'
            when d.clock_in_raw is not null then d.clock_in_raw::time
            when d.day_shape = 'am_half' then time '08:30'
            else time '08:30'
        end)) at time zone 'Asia/Kuala_Lumpur' as clocked_in_at,
        (d.work_date + (case
            when v_type.is_full_day then v_shift_end
            when d.day_shape = 'am_half' then time '12:30'
            when d.clock_out_raw is not null then d.clock_out_raw::time
            when d.day_shape = 'pm_half' then v_shift_end
            else v_shift_end
        end)) at time zone 'Asia/Kuala_Lumpur' as clocked_out_at
    from _days d;

    if exists (select 1 from _resolved where clocked_out_at <= clocked_in_at) then
        raise exception 'Clock out must be after clock in on every date';
    end if;

    -- HALF-DAY GATE, server side. The form seeds times from the shape and
    -- stops you stretching them past four hours -- but a form is an
    -- affordance, not a control, and a row claiming a half day while carrying
    -- a full day's hours would feed payroll the hours.
    if exists (
        select 1 from _resolved
        where day_shape in ('am_half','pm_half')
          and extract(epoch from (clocked_out_at - clocked_in_at)) > 4 * 3600
    ) then
        raise exception 'A half day cannot exceed 4 hours';
    end if;

    -- -----------------------------------------------------------------------
    -- 4. Decide add vs skip, per date
    -- -----------------------------------------------------------------------
    -- Skips are NOT errors and do not abort: an already-recorded day is a
    -- normal thing to hit when someone re-submits a trip they partly entered.
    -- The caller is told which dates were skipped and why.
    create temporary table _decided on commit drop as
    select
        r.*,
        case
            -- Plain scalar comparison, not tstzrange(): the same choice
            -- create_attendance_backfill_rpc.sql already makes, and for the
            -- same reason -- tstzrange() raises "range lower bound must be
            -- less than or equal to range upper bound" the instant it tries
            -- to build a range for ANY existing row whose clocked_out_at is
            -- before its clocked_in_at (a corrupted/legacy row, e.g. from a
            -- manual HR edit with no ordering check), which would fail every
            -- future submission for that employee regardless of the date
            -- being submitted now. coalesce(clocked_out_at, clocked_in_at)
            -- treats a still-open session as a zero-width interval at its
            -- start, so a submission spanning an open session still collides
            -- with it.
            when exists (
                select 1 from public.attendance_activities aa
                where aa.employee_id = p_employee_id
                  and aa.approval_status::text <> 'Rejected'
                  and aa.clocked_in_at < r.clocked_out_at
                  and coalesce(aa.clocked_out_at, aa.clocked_in_at) > r.clocked_in_at
            ) then 'overlaps_existing_activity'

            when not p_allow_leave_conflict and exists (
                select 1 from public.leave_ledger_entries le
                where le.employee_id = p_employee_id
                  and le.leave_date = r.work_date
                group by le.leave_date
                having sum(le.day_fraction) >= 1
            ) then 'full_day_leave_on_record'

            else null
        end as skip_reason
    from _resolved r;

    -- -----------------------------------------------------------------------
    -- 5. Insert, and report
    -- -----------------------------------------------------------------------
    with ins as (
        insert into public.attendance_activities (
            employee_id, attendance_type_id, clocked_in_at, clocked_out_at,
            notes, photo_url, photo_path, entry_method, adjustment_reason_id,
            created_by, approval_status, approved_by, approved_at
        )
        select
            p_employee_id,
            p_attendance_type_id,
            d.clocked_in_at,
            d.clocked_out_at,
            nullif(btrim(p_notes), ''),
            nullif(btrim(p_photo_url), ''),
            nullif(btrim(p_photo_path), ''),
            v_entry_method,
            p_adjustment_reason_id,
            v_actor_employee_id,
            v_approval::public.attendance_approval_status,
            case when v_approval = 'Approved' then v_actor_employee_id end,
            case when v_approval = 'Approved' then now() end
        from _decided d
        where d.skip_reason is null
        order by d.work_date
        returning id, clocked_in_at
    )
    select jsonb_agg(jsonb_build_object(
               'activityId', id,
               'workDate', (clocked_in_at at time zone 'Asia/Kuala_Lumpur')::date
           ) order by clocked_in_at)
    into v_added from ins;

    select jsonb_agg(jsonb_build_object(
               'workDate', work_date,
               'reason', skip_reason
           ) order by work_date)
    into v_skipped from _decided where skip_reason is not null;

    return jsonb_build_object(
        'status',        'applied',
        'employeeId',    p_employee_id,
        'entryMethod',   v_entry_method,
        'approvalStatus', v_approval,
        'addedCount',    coalesce(jsonb_array_length(v_added), 0),
        'skippedCount',  coalesce(jsonb_array_length(v_skipped), 0),
        -- The ids the next feature needs. See the header.
        'added',         coalesce(v_added, '[]'::jsonb),
        'skipped',       coalesce(v_skipped, '[]'::jsonb)
    );
end;
$$;

grant execute on function public.create_attendance_submission(
    uuid, bigint, jsonb, text, text, text, boolean, bigint
) to authenticated;

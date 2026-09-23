-- acknowledge_attendance_day / revoke_attendance_day_acknowledgement:
-- resolving a reconciliation flag so it stops being an open item.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 12 -- requires
-- attendance_reconciliation_acknowledgements_migration.sql (step 11).
--
-- ONLY `insufficient_half_day` IS ACKNOWLEDGEABLE, and only by HR or a
-- superadmin. Acknowledging is to the employee's advantage (it waves away a
-- short day), so it stays with HR.
--
-- ABSENCE ACKNOWLEDGEMENT WAS REMOVED ON 2026-09-23. It was never a payroll
-- decision -- acknowledged + unacknowledged always summed to daysAbsentCount,
-- and payroll deducts in HR2000 regardless -- and every unexcused absence
-- ends up in HR2000 as an NPL entry anyway, which the weekly leave sync turns
-- into an `on_leave` day that clears the flag on its own. Acknowledging here
-- therefore let someone close the review WITHOUT the record ever reaching
-- HR2000: a second, weaker source of truth for a day that has a real one
-- coming.
--
-- An absent day now has exactly two resolutions: attendance is added (they
-- actually worked), or an NPL entry arrives from HR2000. Until one happens the
-- day stays flagged. See docs/hr/ATTENDANCE-DAY-MODEL.md.
--
-- `insufficient_half_day` keeps its acknowledgement because it has no HR2000
-- equivalent: the leave fraction and the hours are both already correct, the
-- day just looks short. There is nothing to record upstream, so acknowledging
-- is the only sensible close.
--
-- The plumbing (the table, the `category` column, the view's
-- is_unacknowledged_* columns) is deliberately left intact and still accepts
-- 'absent' on the REVOKE side -- see that function's own comment.
--
-- security definer + set search_path = '' + fully-qualified public.* names:
-- same hardening as every other SECURITY DEFINER function in this schema.
create or replace function public.acknowledge_attendance_day(
    p_employee_id uuid,
    p_work_date   date,
    p_category    text,
    p_reason_id   bigint,
    p_notes       text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_employee_id uuid;
    v_is_superadmin     boolean;
    v_is_hr             boolean;
    v_flag_present      boolean;
    v_requires_notes    boolean;
    v_existing          public.attendance_reconciliation_acknowledgements;
    v_new_id            bigint;
begin
    v_actor_employee_id := (
        select id from public.employees where profile_id = auth.uid()
    );

    if v_actor_employee_id is null then
        raise exception 'No employee record is linked to your account';
    end if;

    -- 'absent' gets its own rejection ahead of the general one, because the
    -- answer is not "this cannot be acknowledged" but "acknowledging is no
    -- longer how you resolve it". This is the authoritative gate: the UI no
    -- longer offers the action, but a direct REST call to the RPC would
    -- otherwise still write a row.
    if p_category = 'absent' then
        raise exception 'Absences can no longer be acknowledged'
            using hint = 'Record the day in HR2000 -- as an NPL entry if it was genuinely unpaid -- and the next leave sync will clear the flag. If the employee did work, add the attendance activity for that day instead.';
    end if;

    -- leave_conflict and leave_fraction_error resolve themselves on the next
    -- HR2000 leave sync, so acknowledging them would create a second source of
    -- truth for something already converging.
    if p_category <> 'insufficient_half_day' then
        raise exception 'Category % cannot be acknowledged', p_category
            using hint = 'Only insufficient_half_day is acknowledgeable; absences, leave conflicts and leave data errors all clear themselves once the day is corrected in HR2000 and re-synced.';
    end if;

    v_is_superadmin := public.is_superadmin();
    v_is_hr := exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    );

    -- Flat, no longer branched by category: with 'absent' rejected above,
    -- insufficient_half_day is the only category left and it has always been
    -- HR/superadmin-only. The self/manager branch went with the absence.
    if not (v_is_superadmin or v_is_hr) then
        raise exception 'Only HR can acknowledge insufficient half-day hours';
    end if;

    -- The day must genuinely carry the flag being acknowledged. Without this
    -- you could pre-acknowledge a day that was never flagged, permanently
    -- suppressing a problem that had not happened yet.
    --
    -- Mirrors get_payroll_reconciliation_rows()'s own predicate exactly.
    --
    -- is_insufficient_half_day_hours gained a calendar guard in the view on
    -- 2026-09-23. Until then it had none, so a half-day leave recorded against
    -- a Saturday was flagged as needing reconciliation but could not be
    -- acknowledged here -- an unresolvable state.
    --
    -- The `case p_category` this replaced also had an `absent` branch
    -- (day_state = 'absent'); it is gone with the category itself.
    select uda.is_insufficient_half_day_hours
    into v_flag_present
    from public.unified_daily_attendance uda
    where uda.employee_uuid = p_employee_id and uda.work_date = p_work_date;

    if v_flag_present is not true then
        raise exception 'That day is not currently flagged as % for this employee', p_category
            using hint = 'The flag may already have been resolved by a change in the underlying attendance or leave data.';
    end if;

    -- Reason must be active and valid for this category.
    select ar.requires_notes into v_requires_notes
    from public.attendance_acknowledgement_reasons ar
    where ar.id = p_reason_id
      and ar.is_active
      and p_category = any(ar.applicable_categories);

    if not found then
        raise exception 'Reason % is not valid for category %', p_reason_id, p_category;
    end if;

    if v_requires_notes and coalesce(btrim(p_notes), '') = '' then
        raise exception 'This reason requires a written explanation';
    end if;

    -- Idempotent: re-acknowledging an already-acknowledged day returns the
    -- existing row rather than erroring on the unique key. Two people clicking
    -- the same button is not a failure worth surfacing.
    select * into v_existing
    from public.attendance_reconciliation_acknowledgements
    where employee_id = p_employee_id
      and work_date = p_work_date
      and category = p_category;

    if found then
        return jsonb_build_object(
            'status', 'already_acknowledged',
            'id', v_existing.id,
            'acknowledgedAt', v_existing.acknowledged_at
        );
    end if;

    insert into public.attendance_reconciliation_acknowledgements
        (employee_id, work_date, category, reason_id, notes, acknowledged_by)
    values
        (p_employee_id, p_work_date, p_category, p_reason_id,
         nullif(btrim(p_notes), ''), v_actor_employee_id)
    returning id into v_new_id;

    return jsonb_build_object('status', 'acknowledged', 'id', v_new_id);
end;
$$;

-- Revoking: HR/superadmin only. Re-opening a closed payroll item is a
-- different act from closing one, and it should not be possible to quietly
-- un-declare a day after HR has reported on it.
--
-- DELIBERATELY STILL ACCEPTS 'absent', unlike the acknowledge side above.
-- Closing an absence this way is no longer allowed, but any row written
-- before 2026-09-23 must still be clearable -- otherwise removing the feature
-- would strand its own leftovers permanently suppressed. (The table held 0
-- rows at the time, so this is belt-and-braces rather than a migration.)
create or replace function public.revoke_attendance_day_acknowledgement(
    p_employee_id uuid,
    p_work_date   date,
    p_category    text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_deleted integer;
begin
    if not public.is_superadmin()
       and not exists (
           select 1 from public.profiles
           where profiles.id = auth.uid() and profiles.department_id = 7
       )
    then
        raise exception 'Only HR can revoke an acknowledgement';
    end if;

    delete from public.attendance_reconciliation_acknowledgements
    where employee_id = p_employee_id
      and work_date = p_work_date
      and category = p_category;

    get diagnostics v_deleted = row_count;

    return jsonb_build_object('status', 'revoked', 'deletedCount', v_deleted);
end;
$$;

grant execute on function
    public.acknowledge_attendance_day(uuid, date, text, bigint, text)
    to authenticated;
grant execute on function
    public.revoke_attendance_day_acknowledgement(uuid, date, text)
    to authenticated;

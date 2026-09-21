-- acknowledge_attendance_day / revoke_attendance_day_acknowledgement:
-- resolving a reconciliation flag so it stops being an open item.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 12 -- requires
-- attendance_reconciliation_acknowledgements_migration.sql (step 11).
--
-- The write rule is CATEGORY-DEPENDENT, which is exactly why it lives in a
-- function rather than in RLS:
--
--   absent                -> self OR direct manager OR HR OR superadmin
--   insufficient_half_day -> HR OR superadmin only
--
-- An employee confirming their own absence is an admission against their own
-- interest (the day is unpaid either way), so there is nothing to gain by it
-- and no reason to withhold the ability. An employee waving away "insufficient
-- half-day hours" IS to their advantage, so that one stays with HR.
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
    v_is_manager        boolean;
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

    -- Only these two are acknowledgeable. leave_conflict and
    -- leave_fraction_error resolve themselves on the next HR2000 leave sync,
    -- so acknowledging them would create a second source of truth for
    -- something already converging.
    if p_category not in ('absent', 'insufficient_half_day') then
        raise exception 'Category % cannot be acknowledged', p_category
            using hint = 'Only absent and insufficient_half_day are acknowledgeable; leave conflicts and leave data errors clear themselves on the next HR2000 leave sync.';
    end if;

    v_is_superadmin := public.is_superadmin();
    v_is_hr := exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    );
    v_is_manager := exists (
        select 1 from public.employees e
        where e.id = p_employee_id and e.manager_id = v_actor_employee_id
    );

    if p_category = 'absent' then
        if not (v_is_superadmin or v_is_hr or v_is_manager
                or p_employee_id = v_actor_employee_id) then
            raise exception 'Not authorized to acknowledge this absence';
        end if;
    else -- insufficient_half_day
        if not (v_is_superadmin or v_is_hr) then
            raise exception 'Only HR can acknowledge insufficient half-day hours';
        end if;
    end if;

    -- The day must genuinely carry the flag being acknowledged. Without this
    -- you could pre-acknowledge a day that was never flagged, permanently
    -- suppressing a problem that had not happened yet.
    --
    -- Mirrors get_payroll_reconciliation_rows()'s own predicates exactly: the
    -- absent branch needs the not-weekend / not-holiday guards, because
    -- hr_flag = 'Absent' alone also matches every unworked Saturday since
    -- weekend became an independent is_weekend flag.
    select
        case p_category
            when 'absent' then
                uda.hr_flag = 'Absent'
                and not uda.is_weekend
                and not uda.is_public_holiday
            when 'insufficient_half_day' then
                uda.is_insufficient_half_day_hours
        end
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

-- Revoking: HR/superadmin only, even for an absence the employee acknowledged
-- themselves. Re-opening a closed payroll item is a different act from closing
-- one, and it should not be possible to quietly un-declare a day unpaid after
-- HR has reported on it.
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

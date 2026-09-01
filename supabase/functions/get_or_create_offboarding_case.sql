-- arguments: p_employee_id uuid, p_opened_reason text
-- returns: table(case_id uuid, was_newly_created boolean)
--
-- Idempotent get-or-create, same invariant as get_or_create_onboarding_case().
-- Returns was_newly_created (not just a bare id) so the wrapping trigger
-- (handle_employee_offboarding_case_open) can tell a genuine open apart
-- from a no-op re-fire -- needed both to decide whether to emit
-- notifications and whether to run the onboarding-auto-cancel companion
-- logic, neither of which should repeat on a branch re-fire against an
-- already-open case.
--
-- Seeds all 13 fixed offboarding items from
-- src/data/offboardingChecklistMeta.js's own item list (kept manually in
-- sync, same tension as the onboarding function). employee_visible values
-- below match the architecture doc's own worked recommendation table --
-- unlike onboarding, offboarding has real sensitive items (exact
-- revocation timing, internal handover notes) that must never reach the
-- employee's own self-service page, enforced here at the row level, not
-- just in the frontend.
--
-- Two items are conditionally seeded SKIPPED based on real state at the
-- moment the case opens, not just a static appliesIf flag:
--   - it_assets_returned: only relevant if the employee actually has an
--     assigned asset right now (it_assets.asset_user_id) -- the exact
--     inverse of onboarding's it_asset_assigned check.
--   - credentials_rotated: only relevant for elevated-role (manager/
--     superadmin) or IT/Finance-department employees -- shared/admin
--     credential rotation matters specifically for people who plausibly
--     had elevated or financially sensitive access; showing it
--     unconditionally for every departing staff member would just be
--     checklist noise.
--
-- SECURITY DEFINER: same rationale as get_or_create_onboarding_case().
create or replace function public.get_or_create_offboarding_case(
    p_employee_id uuid,
    p_opened_reason text
)
returns table(case_id uuid, was_newly_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_case_id uuid;
    v_had_assets boolean;
    v_credentials_rotated_applies boolean;
begin
    select id into v_case_id
    from public.employee_lifecycle_cases
    where employee_id = p_employee_id and case_type = 'OFFBOARDING' and status = 'OPEN';

    if v_case_id is not null then
        case_id := v_case_id;
        was_newly_created := false;
        return next;
        return;
    end if;

    select exists (
        select 1 from public.it_assets where asset_user_id = p_employee_id
    ) into v_had_assets;

    select exists (
        select 1
        from public.employees e
        left join public.profiles p on p.id = e.profile_id
        left join public.departments d on d.id = e.department_id
        where e.id = p_employee_id
          and (p.role_id in (2, 3) or d.sub in ('IT', 'FIN'))
    ) into v_credentials_rotated_applies;

    insert into public.employee_lifecycle_cases
        (employee_id, case_type, opened_reason, expected_last_day)
    select
        p_employee_id, 'OFFBOARDING', p_opened_reason,
        coalesce(e.resignation_date, e.end_date)
    from public.employees e
    where e.id = p_employee_id
    returning id into v_case_id;

    insert into public.employee_lifecycle_case_items
        (case_id, item_key, owning_department_sub, employee_visible, status, notes)
    values
        (v_case_id, 'resignation_acknowledged',   'HR', false, 'PENDING', null),
        (v_case_id, 'exit_interview_completed',   'HR', true,  'PENDING', null),
        (v_case_id, 'handover_plan_documented',   'HR', false, 'PENDING', null),
        (v_case_id, 'leave_balance_settled',      'HR', true,  'PENDING', null),
        (v_case_id, 'final_settlement_processed', 'HR', true,  'PENDING', null),
        (v_case_id, 'statutory_benefits_cessation','HR', true, 'PENDING', null),
        (v_case_id, 'certificate_of_service_issued','HR', true,'PENDING', null),
        (v_case_id, 'employee_file_closed',       'HR', true,  'PENDING', null),
        (v_case_id, 'it_assets_returned',         'IT', true,
            (case when v_had_assets then 'PENDING' else 'SKIPPED' end)::public.lifecycle_item_status,
            case when v_had_assets then null else 'no IT asset was assigned to this employee' end),
        (v_case_id, 'software_access_revoked',    'IT', false, 'PENDING', null),
        (v_case_id, 'workspace_account_revoked',  'IT', false, 'PENDING', null),
        (v_case_id, 'credentials_rotated',        'IT', false,
            (case when v_credentials_rotated_applies then 'PENDING' else 'SKIPPED' end)::public.lifecycle_item_status,
            case when v_credentials_rotated_applies then null
                 else 'not an elevated-role or IT/Finance-department employee' end),
        -- Derived -- only ever flipped to DONE by
        -- sync_lifecycle_item_on_profile_deactivated, never manually.
        (v_case_id, 'portal_account_deactivated', 'IT', false, 'PENDING', null);

    case_id := v_case_id;
    was_newly_created := true;
    return next;
end;
$$;

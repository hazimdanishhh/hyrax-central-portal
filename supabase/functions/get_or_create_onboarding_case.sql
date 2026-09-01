-- arguments: p_employee_id uuid, p_opened_reason text
-- returns: uuid (the case's id, whether newly created or already existing)
--
-- Idempotent get-or-create against employee_lifecycle_cases_one_open_per_type_idx
-- -- calling this twice for the same employee returns the same case_id and
-- never re-seeds items. On a genuine create, seeds all 12 fixed onboarding
-- items from src/data/onboardingChecklistMeta.js's own item list -- kept
-- manually in sync with that file (the JS file is the source of truth for
-- label/sort-order content, this function is the source of truth for which
-- rows get created and their owning_department_sub/employee_visible seed
-- values, the same tension already accepted for owning_department_sub
-- itself in the architecture doc).
--
-- Every item is seeded, even ones that don't apply to this employee (the
-- three device/access-card items, when needs_it_asset is not true) --
-- inserted immediately as SKIPPED with an auto-generated note, so HR/IT
-- always see the full standard checklist with some rows greyed out and a
-- reason, never a checklist whose length silently varies per employee.
--
-- All onboarding items are employee_visible = true -- unlike offboarding,
-- there's nothing about a new hire's own onboarding that needs hiding from
-- them; the employee's self-service page collapses these into a simplified
-- 4-milestone rollup client-side, but the underlying rows must be readable
-- via RLS for that rollup to have anything to compute from.
--
-- SECURITY DEFINER: called from the AFTER INSERT trigger on employees (runs
-- under whatever privileges the inserting session has -- HR's own session
-- for a normal create, or the backfill script's superadmin session) but
-- must write into employee_lifecycle_cases/_items regardless of the
-- caller's own RLS standing on those tables, which are locked down to
-- select/update-only for everyone but superadmin.
create or replace function public.get_or_create_onboarding_case(
    p_employee_id uuid,
    p_opened_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_case_id uuid;
    v_needs_it_asset boolean;
begin
    select id into v_case_id
    from public.employee_lifecycle_cases
    where employee_id = p_employee_id and case_type = 'ONBOARDING' and status = 'OPEN';

    if v_case_id is not null then
        return v_case_id;
    end if;

    select needs_it_asset into v_needs_it_asset from public.employees where id = p_employee_id;

    insert into public.employee_lifecycle_cases (employee_id, case_type, opened_reason, employee_can_view)
    values (p_employee_id, 'ONBOARDING', p_opened_reason, true)
    returning id into v_case_id;

    insert into public.employee_lifecycle_case_items
        (case_id, item_key, owning_department_sub, employee_visible, status, notes)
    values
        (v_case_id, 'hr_documents_collected',    'HR', true, 'PENDING', null),
        (v_case_id, 'hr_onboarding_briefing',     'HR', true, 'PENDING', null),
        (v_case_id, 'workspace_account_created',  'IT', true, 'PENDING', null),
        (v_case_id, 'personal_email_notified',    'IT', true, 'PENDING', null),
        (v_case_id, 'portal_invite_sent',         'IT', true, 'PENDING', null),
        (v_case_id, 'device_access_card_ready',   'IT', true,
            (case when v_needs_it_asset = true then 'PENDING' else 'SKIPPED' end)::public.lifecycle_item_status,
            case when v_needs_it_asset = true then null else 'needs_it_asset is not true' end),
        (v_case_id, 'it_asset_assigned',          'IT', true,
            (case when v_needs_it_asset = true then 'PENDING' else 'SKIPPED' end)::public.lifecycle_item_status,
            case when v_needs_it_asset = true then null else 'needs_it_asset is not true' end),
        (v_case_id, 'device_handed_over',         'IT', true,
            (case when v_needs_it_asset = true then 'PENDING' else 'SKIPPED' end)::public.lifecycle_item_status,
            case when v_needs_it_asset = true then null else 'needs_it_asset is not true' end),
        (v_case_id, 'it_onboarding_briefing',     'IT', true, 'PENDING', null),
        (v_case_id, 'software_access_provisioned','IT', true, 'PENDING', null),
        -- Derived items -- only ever flipped to DONE by the sync triggers
        -- (sync_lifecycle_item_on_profile_linked/_on_role_department_assigned),
        -- never manually. owning_department_sub still set for display
        -- purposes (the owner badge in the UI), even though writes to these
        -- two rows only ever come from a SECURITY DEFINER trigger, not a
        -- human via the RLS-gated update policy.
        (v_case_id, 'profile_linked',             'HR',  true, 'PENDING', null),
        (v_case_id, 'role_department_assigned',    null,  true, 'PENDING', null);

    return v_case_id;
end;
$$;

-- arguments: none (trigger function)
-- returns: trigger
--
-- AFTER UPDATE OF status ON public.employee_lifecycle_case_items. When an
-- item reaches DONE/SKIPPED, checks whether every seeded item for its case
-- has now reached DONE/SKIPPED -- if so, flips the case to COMPLETED. No
-- separate required-vs-optional item tier for v1, matching the
-- fixed-checklist brief: "complete" means every seeded item, full stop.
--
-- Agnostic to whether the item that just finished was a manual checkbox
-- tick or a derived-item sync (the sync_lifecycle_item_on_* triggers all
-- write through this same status column) -- one completion mechanism, not
-- two.
--
-- Deliberate departure from Workspace Projects' manual-only completion (a
-- project can be fully task-complete and still waiting on sign-off): a
-- checklist's "done" is a mechanical AND of already-verified facts, with
-- no separate judgment call left once every fact is true.
--
-- `where status = 'OPEN'` on the case update means a manually-reopened
-- case (see the architecture doc's "Manual status override" section)
-- naturally becomes eligible to auto-complete again the next time an item
-- changes, with no special-casing needed.
--
-- SECURITY DEFINER: needs to read/write employee_lifecycle_cases
-- regardless of the caller's own RLS standing on that table (an IT
-- staffer's session, an HR session, or a sync trigger's SECURITY DEFINER
-- context re-entering this trigger).
create or replace function public.check_lifecycle_case_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_case record;
begin
    if new.status not in ('DONE', 'SKIPPED') then
        return new;
    end if;

    if exists (
        select 1 from public.employee_lifecycle_case_items
        where case_id = new.case_id and status not in ('DONE', 'SKIPPED')
    ) then
        return new;
    end if;

    select * into v_case from public.employee_lifecycle_cases where id = new.case_id and status = 'OPEN';
    if v_case is null then
        return new;
    end if;

    update public.employee_lifecycle_cases
        set status = 'COMPLETED', closed_at = now(), closed_reason = 'all_items_complete'
        where id = new.case_id;

    begin
        if v_case.case_type = 'ONBOARDING' then
            perform public.emit_notification_event(
                'employee.onboarding_checklist_completed', 'employee_lifecycle_cases', v_case.id::text,
                jsonb_build_object(
                    'case_id', v_case.id, 'employee_id', v_case.employee_id,
                    'new_profile_id', (select profile_id from public.employees where id = v_case.employee_id),
                    'title', 'Onboarding Complete',
                    'message', 'Your onboarding checklist is complete.',
                    'link_to', '/app/profile'
                )
            );
        else
            perform public.emit_notification_event(
                'employee.offboarding_case_completed', 'employee_lifecycle_cases', v_case.id::text,
                jsonb_build_object(
                    'case_id', v_case.id, 'employee_id', v_case.employee_id,
                    'title', 'Offboarding Complete',
                    'message', format(
                        'Offboarding for %s is complete.',
                        (select full_name from public.employees where id = v_case.employee_id)
                    ),
                    'link_to', '/app/hr/offboarding/' || v_case.id
                )
            );
        end if;
    exception when others then
        raise warning 'lifecycle case completion notification failed for case %: %', v_case.id, sqlerrm;
    end;

    return new;
end;
$$;

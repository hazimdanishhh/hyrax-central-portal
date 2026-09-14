-- arguments: none (trigger function)
-- returns: trigger
--
-- Closes the gap noted in docs/PROJECTS-TASKS-ARCHITECTURE.md: `status`
-- was manual-only on the completion side with nothing gating the VALUE --
-- a project could be marked COMPLETED via the Edit Project form's status
-- dropdown regardless of open tasks, with only a cosmetic "all tasks
-- complete" nudge banner in ProjectDetailLayout.jsx as a hint. Fires only
-- on an actual transition INTO COMPLETED (new.status = 'COMPLETED' and
-- old.status <> 'COMPLETED') -- editing any other field, or moving
-- between PLANNING/ACTIVE/ON_HOLD/CANCELLED, never touches this check.
--
-- Same shape as block_role_change_to_cc_with_active_tasks.sql: security
-- definer (reads `tasks` regardless of the acting user's own visibility
-- into other rows), superadmin bypass, blocking items named in the
-- raised message.
create or replace function public.block_project_completion_with_incomplete_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_blocking_titles text;
begin
    if new.status <> 'COMPLETED' or old.status = 'COMPLETED' then
        return new; -- only relevant for an actual transition into COMPLETED
    end if;

    if public.is_superadmin() then
        return new;
    end if;

    select string_agg(title, ', ' order by title)
        into v_blocking_titles
    from public.tasks
    where project_id = new.id
      and status not in ('COMPLETED', 'CANCELLED');

    if v_blocking_titles is not null then
        raise exception
            'Cannot mark this project as Completed: still has incomplete task(s): %. Complete or cancel them first.',
            v_blocking_titles
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

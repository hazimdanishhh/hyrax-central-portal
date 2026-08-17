-- arguments: none (trigger function)
-- returns: trigger
--
-- Req #3: a member can only be removed once every task assigned to them
-- IN THIS PROJECT is COMPLETED or CANCELLED. CANCELLED does not block --
-- a cancelled task is moot, not outstanding work.
--
-- Same cascade guard, same rationale, as
-- block_owner_removal_from_project_members.sql -- without it, deleting a
-- project with any live (non-completed, non-cancelled) task would always
-- fail here too, since the cascade sweeps up every member row, including
-- ones still carrying in-flight tasks.
--
-- SECURITY DEFINER because this must reliably read task_assignees/tasks
-- regardless of whatever SELECT policy those tables carry for the
-- specific user performing the removal -- the DELETE itself already
-- passed project_members' own DELETE RLS policy by the time this fires,
-- so this trigger is confirming a fact about the data, not re-authorizing
-- the action.
create or replace function public.block_project_member_removal_with_active_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_blocking_titles text;
begin
    if not exists (select 1 from public.projects where id = old.project_id) then
        return old; -- whole project is being deleted (cascade), not a standalone member removal
    end if;

    if public.is_superadmin() then
        return old;
    end if;

    select string_agg(t.title, ', ' order by t.title)
        into v_blocking_titles
    from public.task_assignees ta
    join public.tasks t on t.id = ta.task_id
    where t.project_id = old.project_id
      and ta.employee_id = old.employee_id
      and t.status not in ('COMPLETED', 'CANCELLED');

    if v_blocking_titles is not null then
        raise exception
            'Cannot remove this member: still assigned to incomplete task(s): %. Reassign, or mark these complete/cancelled, first.',
            v_blocking_titles
            using errcode = 'check_violation';
    end if;

    return old;
end;
$$;

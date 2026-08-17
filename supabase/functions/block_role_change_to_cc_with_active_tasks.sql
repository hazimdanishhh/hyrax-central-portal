-- arguments: none (trigger function)
-- returns: trigger
--
-- Closes a gap on the opposite side of req #5's own integrity rule:
-- enforce_task_assignee_is_project_member.sql already blocks ASSIGNING a
-- cc to a task, but nothing stopped DEMOTING an existing working member
-- (owner/lead/member) to cc while they still hold active task_assignees
-- rows in that project -- which would leave those rows pointing at an
-- employee who's no longer a valid assignee, the same integrity violation
-- reached from the other direction. Fires only on an actual transition
-- INTO cc (old.role <> 'cc' and new.role = 'cc') -- changing between
-- owner/lead/member, or already being cc, never touches this check.
--
-- Same cascade-guard shape is NOT needed here (unlike the two DELETE
-- guards) -- this is an UPDATE trigger, never fired by a project-deletion
-- cascade, so there's no "whole project being torn down" case to
-- distinguish from.
--
-- SECURITY DEFINER because this must reliably read task_assignees/tasks
-- regardless of whatever SELECT policy those tables carry for the
-- specific user performing the role change -- the UPDATE itself already
-- passed project_members' own UPDATE RLS policy by the time this fires,
-- so this trigger is confirming a fact about the data, not re-authorizing
-- the action. Mirrors block_project_member_removal_with_active_tasks.sql's
-- exact shape and message style.
create or replace function public.block_role_change_to_cc_with_active_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_blocking_titles text;
begin
    if new.role <> 'cc' or old.role = 'cc' then
        return new; -- only relevant for an actual transition into cc
    end if;

    if public.is_superadmin() then
        return new;
    end if;

    select string_agg(t.title, ', ' order by t.title)
        into v_blocking_titles
    from public.task_assignees ta
    join public.tasks t on t.id = ta.task_id
    where t.project_id = new.project_id
      and ta.employee_id = new.employee_id
      and t.status not in ('COMPLETED', 'CANCELLED');

    if v_blocking_titles is not null then
        raise exception
            'Cannot change this member to CC: still assigned to incomplete task(s): %. Reassign, or mark these complete/cancelled, first.',
            v_blocking_titles
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

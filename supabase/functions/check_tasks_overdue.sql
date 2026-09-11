-- arguments: none
-- returns: void
--
-- Scheduled-scan escalation counterpart to check_tasks_due_soon.sql --
-- same per-(task, assignee)-pair dedup shape, but RECURRING (7-day
-- cooldown via task_assignees.overdue_last_notified_at) rather than
-- one-shot, matching check_projects_overdue.sql's/
-- check_employee_confirmations_overdue.sql's own 7-day cadence.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- check_* function in this system.
create or replace function public.check_tasks_overdue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_task record;
    v_pair record;
begin
    for v_task in
        select id, title, due_date, project_id
        from public.tasks
        where due_date < current_date
          and status not in ('COMPLETED', 'CANCELLED')
    loop
        for v_pair in
            select ta.employee_id, e.profile_id
            from public.task_assignees ta
            join public.employees e on e.id = ta.employee_id
            where ta.task_id = v_task.id
              and e.profile_id is not null
              and (ta.overdue_last_notified_at is null or ta.overdue_last_notified_at < now() - interval '7 days')
        loop
            begin
                perform public.emit_notification_event(
                    'task.overdue', 'tasks', v_task.id::text,
                    jsonb_build_object(
                        'task_id', v_task.id,
                        'due_date', v_task.due_date,
                        'assignee_profile_id', v_pair.profile_id,
                        'title', 'Task Overdue',
                        'message', format('Task "%s" was due on %s and is now overdue.', v_task.title, v_task.due_date),
                        'link_to', public.task_notification_link(v_task.id, v_task.project_id, v_pair.employee_id)
                    )
                );

                update public.task_assignees
                    set overdue_last_notified_at = now()
                    where task_id = v_task.id and employee_id = v_pair.employee_id;
            exception when others then
                raise warning 'task.overdue notification failed for task % employee %: %',
                    v_task.id, v_pair.employee_id, sqlerrm;
            end;
        end loop;
    end loop;
end;
$$;

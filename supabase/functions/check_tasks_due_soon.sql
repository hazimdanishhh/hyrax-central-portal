-- arguments: none
-- returns: void
--
-- Scheduled-scan ("Shape B") notification source. Dedup is keyed per
-- (task, assignee) PAIR, not per task -- a task can have multiple
-- assignees (task_assignees is many-to-many) who can be added/removed
-- independently, so the cooldown columns live directly on
-- task_assignees (see task_assignees_add_reminder_columns.sql), stamped
-- per-pair inside the inner loop -- unlike
-- check_project_deadlines_approaching.sql's per-project stamp, since
-- there the audience is resolved fresh each scan rather than tied to a
-- fixed pairing.
--
-- notify_task_due_date_changed.sql clears due_soon_reminder_sent_at back
-- to null whenever a task's due_date changes, so a rescheduled deadline
-- gets its own fresh one-shot reminder per assignee.
--
-- SECURITY DEFINER + set search_path = '': runs under pg_cron with no
-- calling user session at all, same reasoning as every other check_*
-- function in this system.
create or replace function public.check_tasks_due_soon()
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
        select id, title, due_date
        from public.tasks
        where due_date between current_date and current_date + 3
          and status not in ('COMPLETED', 'CANCELLED')
    loop
        for v_pair in
            select ta.employee_id, e.profile_id
            from public.task_assignees ta
            join public.employees e on e.id = ta.employee_id
            where ta.task_id = v_task.id
              and e.profile_id is not null
              and ta.due_soon_reminder_sent_at is null
        loop
            begin
                perform public.emit_notification_event(
                    'task.due_soon', 'tasks', v_task.id::text,
                    jsonb_build_object(
                        'task_id', v_task.id,
                        'due_date', v_task.due_date,
                        'assignee_profile_id', v_pair.profile_id,
                        'title', 'Task Due Soon',
                        'message', format('Task "%s" is due on %s.', v_task.title, v_task.due_date),
                        'link_to', '/app/workspace/tasks/' || v_task.id
                    )
                );

                update public.task_assignees
                    set due_soon_reminder_sent_at = now()
                    where task_id = v_task.id and employee_id = v_pair.employee_id;
            exception when others then
                raise warning 'task.due_soon notification failed for task % employee %: %',
                    v_task.id, v_pair.employee_id, sqlerrm;
            end;
        end loop;
    end loop;
end;
$$;

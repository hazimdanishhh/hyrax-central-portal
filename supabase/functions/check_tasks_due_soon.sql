-- arguments: none
-- returns: void
--
-- Scheduled-scan ("Shape B") notification source -- DIGESTED per
-- recipient (2026-09), not per task. Originally emitted one event per
-- (task, assignee) pair, which meant an assignee with 5 tasks all newly
-- due-soon on the same scan run got 5 separate `notifications` rows.
-- Restructured to group by assignee first: one emit per employee,
-- carrying a task_count, linking to the already-existing, fully-wired
-- `dueStatus=due_soon` filter on My Tasks (getMyTasksFilterConfig /
-- fetchMyTasks) rather than any one specific task.
--
-- Dedup is still keyed per (task, assignee) PAIR underneath -- the
-- cooldown columns still live on task_assignees (see
-- task_assignees_add_reminder_columns.sql), stamped per-recipient inside
-- the loop, scoped to that recipient's own currently-qualifying pairs.
-- This is safe even though multiple recipients can share the same task:
-- the outer FOR-IN-query loop's result set (and each recipient's count)
-- is fixed at query-open time, so one recipient's stamping UPDATE mid-loop
-- cannot retroactively change what any other recipient's row already
-- counted.
--
-- entity_id is now the recipient's employee_id, not a specific task_id --
-- a deliberate departure from every other event's "entity_id = the row
-- that changed" convention, unavoidable once one event represents a
-- summary of several rows rather than one fact.
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
    v_recipient record;
begin
    for v_recipient in
        select ta.employee_id, e.profile_id, count(*) as task_count
        from public.tasks t
        join public.task_assignees ta on ta.task_id = t.id
        join public.employees e on e.id = ta.employee_id
        where t.due_date between current_date and current_date + 3
          and t.status not in ('COMPLETED', 'CANCELLED')
          and ta.due_soon_reminder_sent_at is null
          and e.profile_id is not null
        group by ta.employee_id, e.profile_id
    loop
        begin
            perform public.emit_notification_event(
                'task.due_soon', 'task_assignees', v_recipient.employee_id::text,
                jsonb_build_object(
                    'employee_id', v_recipient.employee_id,
                    'assignee_profile_id', v_recipient.profile_id,
                    'task_count', v_recipient.task_count,
                    'title', 'Tasks Due Soon',
                    'message', format(
                        'You have %s task%s due soon.',
                        v_recipient.task_count,
                        case when v_recipient.task_count = 1 then '' else 's' end
                    ),
                    'link_to', '/app/workspace/tasks?dueStatus=due_soon'
                )
            );

            update public.task_assignees ta
                set due_soon_reminder_sent_at = now()
                from public.tasks t
                where ta.task_id = t.id
                  and ta.employee_id = v_recipient.employee_id
                  and t.due_date between current_date and current_date + 3
                  and t.status not in ('COMPLETED', 'CANCELLED')
                  and ta.due_soon_reminder_sent_at is null;
        exception when others then
            raise warning 'task.due_soon notification failed for employee %: %',
                v_recipient.employee_id, sqlerrm;
        end;
    end loop;
end;
$$;

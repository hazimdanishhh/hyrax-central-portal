-- arguments: none
-- returns: void
--
-- Scheduled-scan escalation counterpart to check_tasks_due_soon.sql --
-- DIGESTED per recipient (2026-09), same restructuring/reasoning as that
-- file's own header comment. RECURRING DAILY (changed 2026-09 from a
-- 7-day cooldown) via task_assignees.overdue_last_notified_at -- re-fires
-- once per calendar day for as long as a task is still overdue, so the
-- daily 9AM run gives everyone a fresh glimpse of what's still overdue,
-- not just a once-a-week nudge.
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
    v_recipient record;
begin
    for v_recipient in
        select ta.employee_id, e.profile_id, count(*) as task_count
        from public.tasks t
        join public.task_assignees ta on ta.task_id = t.id
        join public.employees e on e.id = ta.employee_id
        where t.due_date < current_date
          and t.status not in ('COMPLETED', 'CANCELLED')
          and (ta.overdue_last_notified_at is null or ta.overdue_last_notified_at::date < current_date)
          and e.profile_id is not null
        group by ta.employee_id, e.profile_id
    loop
        begin
            perform public.emit_notification_event(
                'task.overdue', 'task_assignees', v_recipient.employee_id::text,
                jsonb_build_object(
                    'employee_id', v_recipient.employee_id,
                    'assignee_profile_id', v_recipient.profile_id,
                    'task_count', v_recipient.task_count,
                    'title', 'Tasks Overdue',
                    'message', format(
                        'You have %s overdue task%s.',
                        v_recipient.task_count,
                        case when v_recipient.task_count = 1 then '' else 's' end
                    ),
                    'link_to', '/app/workspace/tasks?dueStatus=overdue'
                )
            );

            update public.task_assignees ta
                set overdue_last_notified_at = now()
                from public.tasks t
                where ta.task_id = t.id
                  and ta.employee_id = v_recipient.employee_id
                  and t.due_date < current_date
                  and t.status not in ('COMPLETED', 'CANCELLED')
                  and (ta.overdue_last_notified_at is null or ta.overdue_last_notified_at::date < current_date);
        exception when others then
            raise warning 'task.overdue notification failed for employee %: %',
                v_recipient.employee_id, sqlerrm;
        end;
    end loop;
end;
$$;

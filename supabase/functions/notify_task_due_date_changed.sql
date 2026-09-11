-- arguments: none (trigger function)
-- returns: trigger
--
-- Same dynamic-recipient loop shape as notify_task_status_changed.sql --
-- audience is "this task's current assignees except whoever made the
-- change."
--
-- Also resets the per-assignee due_soon/overdue cooldown columns (see
-- task_assignees_add_reminder_columns.sql) for EVERY current assignee,
-- unconditionally (not excluding the actor) -- a rescheduled due date
-- means the old "already reminded" facts no longer describe the current
-- deadline, so the new date needs its own fresh reminder cycle. This
-- reset is silent bookkeeping, not a second notification -- keeps this
-- pass from over-notifying (see docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md).
--
-- SECURITY DEFINER + set search_path = '': resolves each recipient's
-- profile_id regardless of the ACTING user's own RLS visibility into
-- employees -- same reasoning block_role_change_to_cc_with_active_tasks.sql
-- gives for the identical hardening.
create or replace function public.notify_task_due_date_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_employee_id uuid;
    v_recipient record;
begin
    if old.due_date is not distinct from new.due_date then
        return new; -- UPDATE OF due_date can still fire on a no-op set
    end if;

    v_actor_employee_id := public.current_employee_id();

    for v_recipient in
        select e.profile_id
        from public.task_assignees ta
        join public.employees e on e.id = ta.employee_id
        where ta.task_id = new.id
          and ta.employee_id is distinct from v_actor_employee_id
          and e.profile_id is not null
    loop
        begin
            perform public.emit_notification_event(
                'task.due_date_changed', 'tasks', new.id::text,
                jsonb_build_object(
                    'task_id', new.id,
                    'project_id', new.project_id,
                    'old_due_date', old.due_date,
                    'new_due_date', new.due_date,
                    'recipient_profile_id', v_recipient.profile_id,
                    'title', 'Task Due Date Changed',
                    'message', case
                        when new.due_date is null then format('Task "%s" no longer has a due date.', new.title)
                        else format('Task "%s" is now due on %s.', new.title, new.due_date)
                    end,
                    'link_to', '/app/workspace/tasks/' || new.id
                )
            );
        exception when others then
            raise warning 'task.due_date_changed notification failed for task % recipient %: %',
                new.id, v_recipient.profile_id, sqlerrm;
        end;
    end loop;

    -- Silent cooldown reset -- every current assignee, unconditionally
    -- (including the actor, if they're also an assignee), so the new
    -- deadline gets a fresh due_soon/overdue reminder cycle. No event
    -- emitted for this half.
    begin
        update public.task_assignees
            set due_soon_reminder_sent_at = null,
                overdue_last_notified_at = null
            where task_id = new.id;
    exception when others then
        raise warning 'task_assignees reminder cooldown reset failed for task %: %', new.id, sqlerrm;
    end;

    return new;
end;
$$;

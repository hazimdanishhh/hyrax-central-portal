-- arguments: none
-- returns: void
--
-- Scheduled-scan ("Shape B") notification source, mirroring
-- check_employee_confirmations_due_soon.sql's shape, but with a nested
-- dynamic-recipient loop (same pattern as notify_project_status_changed.sql)
-- inside the scan loop -- audience is "every current project member, any
-- role including cc" (matching project.status_changed's own precedent),
-- not a single fixed recipient.
--
-- The cooldown is stamped ONCE PER PROJECT after the inner loop
-- completes, not per-recipient -- the dedup unit here is "has this
-- project's approaching-deadline reminder already gone out," since the
-- audience is resolved fresh every scan rather than tied to a specific
-- (project, member) pairing the way task.due_soon/task.overdue are (see
-- check_tasks_due_soon.sql for that contrast).
--
-- reset_project_deadline_reminder_cooldowns.sql clears
-- deadline_reminder_sent_at back to null whenever target_end_date
-- changes, so a rescheduled deadline gets its own fresh one-shot
-- reminder.
--
-- SECURITY DEFINER + set search_path = '': runs under pg_cron with no
-- calling user session at all, same reasoning as every other check_*
-- function in this system.
create or replace function public.check_project_deadlines_approaching()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_project record;
    v_recipient record;
begin
    for v_project in
        select id, name, target_end_date
        from public.projects
        where target_end_date between current_date and current_date + 3
          and status not in ('COMPLETED', 'CANCELLED')
          and deadline_reminder_sent_at is null
    loop
        begin
            for v_recipient in
                select e.profile_id
                from public.project_members pm
                join public.employees e on e.id = pm.employee_id
                where pm.project_id = v_project.id
                  and e.profile_id is not null
            loop
                begin
                    perform public.emit_notification_event(
                        'project.deadline_approaching', 'projects', v_project.id::text,
                        jsonb_build_object(
                            'project_id', v_project.id,
                            'target_end_date', v_project.target_end_date,
                            'recipient_profile_id', v_recipient.profile_id,
                            'title', 'Project Deadline Approaching',
                            'message', format('Project "%s" is due on %s.', v_project.name, v_project.target_end_date),
                            'link_to', '/app/workspace/projects/' || v_project.id
                        )
                    );
                exception when others then
                    raise warning 'project.deadline_approaching notification failed for project % recipient %: %',
                        v_project.id, v_recipient.profile_id, sqlerrm;
                end;
            end loop;

            update public.projects
                set deadline_reminder_sent_at = now()
                where id = v_project.id;
        exception when others then
            raise warning 'project deadline-approaching scan failed for project %: %', v_project.id, sqlerrm;
        end;
    end loop;
end;
$$;

-- arguments: none
-- returns: void
--
-- Scheduled-scan escalation counterpart to
-- check_project_deadlines_approaching.sql -- DIGESTED per recipient
-- (2026-09), same restructuring/reasoning as that file's own header
-- comment. RECURRING (7-day cooldown via projects.overdue_last_notified_at)
-- rather than one-shot, matching check_tasks_overdue.sql's/
-- check_employee_confirmations_overdue.sql's own 7-day cadence. Links to
-- the `dueStatus=overdue` filter on the Projects page.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- check_* function in this system.
create or replace function public.check_projects_overdue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_recipient record;
begin
    for v_recipient in
        select pm.employee_id, e.profile_id, count(*) as project_count
        from public.projects p
        join public.project_members pm on pm.project_id = p.id
        join public.employees e on e.id = pm.employee_id
        where p.target_end_date < current_date
          and p.status not in ('COMPLETED', 'CANCELLED')
          and (p.overdue_last_notified_at is null or p.overdue_last_notified_at < now() - interval '7 days')
          and e.profile_id is not null
        group by pm.employee_id, e.profile_id
    loop
        begin
            perform public.emit_notification_event(
                'project.overdue', 'project_members', v_recipient.employee_id::text,
                jsonb_build_object(
                    'employee_id', v_recipient.employee_id,
                    'recipient_profile_id', v_recipient.profile_id,
                    'project_count', v_recipient.project_count,
                    'title', 'Projects Overdue',
                    'message', format(
                        'You have %s overdue project%s.',
                        v_recipient.project_count,
                        case when v_recipient.project_count = 1 then '' else 's' end
                    ),
                    'link_to', '/app/workspace/projects?dueStatus=overdue'
                )
            );

            update public.projects p
                set overdue_last_notified_at = now()
                where (p.overdue_last_notified_at is null or p.overdue_last_notified_at < now() - interval '7 days')
                  and p.target_end_date < current_date
                  and p.status not in ('COMPLETED', 'CANCELLED')
                  and exists (
                      select 1 from public.project_members pm
                      where pm.project_id = p.id and pm.employee_id = v_recipient.employee_id
                  );
        exception when others then
            raise warning 'project.overdue notification failed for employee %: %',
                v_recipient.employee_id, sqlerrm;
        end;
    end loop;
end;
$$;

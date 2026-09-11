-- arguments: none
-- returns: void
--
-- Scheduled-scan escalation counterpart to
-- check_project_deadlines_approaching.sql -- once target_end_date
-- actually passes and the project still isn't COMPLETED/CANCELLED, this
-- takes over. Same nested-loop shape (scan + dynamic-recipient audience),
-- but RECURRING (7-day cooldown) rather than one-shot, since an overdue
-- project is an ongoing, unresolved state worth re-nagging about -- same
-- reasoning check_employee_confirmations_overdue.sql gives for its own
-- 7-day cooldown.
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
    v_project record;
    v_recipient record;
begin
    for v_project in
        select id, name, target_end_date
        from public.projects
        where target_end_date < current_date
          and status not in ('COMPLETED', 'CANCELLED')
          and (overdue_last_notified_at is null or overdue_last_notified_at < now() - interval '7 days')
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
                        'project.overdue', 'projects', v_project.id::text,
                        jsonb_build_object(
                            'project_id', v_project.id,
                            'target_end_date', v_project.target_end_date,
                            'recipient_profile_id', v_recipient.profile_id,
                            'title', 'Project Overdue',
                            'message', format('Project "%s" was due on %s and is now overdue.', v_project.name, v_project.target_end_date),
                            'link_to', '/app/workspace/projects/' || v_project.id
                        )
                    );
                exception when others then
                    raise warning 'project.overdue notification failed for project % recipient %: %',
                        v_project.id, v_recipient.profile_id, sqlerrm;
                end;
            end loop;

            update public.projects
                set overdue_last_notified_at = now()
                where id = v_project.id;
        exception when others then
            raise warning 'project overdue scan failed for project %: %', v_project.id, sqlerrm;
        end;
    end loop;
end;
$$;

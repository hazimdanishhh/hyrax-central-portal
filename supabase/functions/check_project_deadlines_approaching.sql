-- arguments: none
-- returns: void
--
-- Scheduled-scan ("Shape B") notification source -- DIGESTED per
-- recipient (2026-09), same restructuring as check_tasks_due_soon.sql's
-- own header comment: one emit per member (with a project_count), not one
-- per (project, member) pair. Links to the `dueStatus=due_soon` filter on
-- the Projects page (getProjectsFilterConfig / fetchProjects), mirroring
-- My Tasks' own dueStatus filter.
--
-- The cooldown column lives one level removed from what's being
-- aggregated here (deadline_reminder_sent_at is on `projects`, but the
-- digest groups by `project_members.employee_id`) -- unlike the task
-- version, where the cooldown lives directly on the pair being grouped.
-- Verified this still needs no two-pass snapshot: PL/pgSQL's
-- `for rec in <query> loop` fixes its result set at query-open time, so
-- one recipient's cooldown-stamping UPDATE mid-loop can't retroactively
-- change another recipient's already-captured row/count -- the same
-- single-pass shape as the task version works here too. If a project has
-- 3 members all being notified in this same scan, its
-- deadline_reminder_sent_at just gets set 3 times (once per member's own
-- UPDATE) -- harmless, idempotent.
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
    v_recipient record;
begin
    for v_recipient in
        select pm.employee_id, e.profile_id, count(*) as project_count
        from public.projects p
        join public.project_members pm on pm.project_id = p.id
        join public.employees e on e.id = pm.employee_id
        where p.target_end_date between current_date and current_date + 3
          and p.status not in ('COMPLETED', 'CANCELLED')
          and p.deadline_reminder_sent_at is null
          and e.profile_id is not null
        group by pm.employee_id, e.profile_id
    loop
        begin
            perform public.emit_notification_event(
                'project.deadline_approaching', 'project_members', v_recipient.employee_id::text,
                jsonb_build_object(
                    'employee_id', v_recipient.employee_id,
                    'recipient_profile_id', v_recipient.profile_id,
                    'project_count', v_recipient.project_count,
                    'title', 'Project Deadlines Approaching',
                    'message', format(
                        'You have %s project%s with a deadline approaching.',
                        v_recipient.project_count,
                        case when v_recipient.project_count = 1 then '' else 's' end
                    ),
                    'link_to', '/app/workspace/projects?dueStatus=due_soon'
                )
            );

            update public.projects p
                set deadline_reminder_sent_at = now()
                where p.deadline_reminder_sent_at is null
                  and p.target_end_date between current_date and current_date + 3
                  and p.status not in ('COMPLETED', 'CANCELLED')
                  and exists (
                      select 1 from public.project_members pm
                      where pm.project_id = p.id and pm.employee_id = v_recipient.employee_id
                  );
        exception when others then
            raise warning 'project.deadline_approaching notification failed for employee %: %',
                v_recipient.employee_id, sqlerrm;
        end;
    end loop;
end;
$$;

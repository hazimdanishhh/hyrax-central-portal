-- arguments: none
-- returns: void
--
-- Scheduled-scan reminder for attendance activities stuck in the pending-
-- approval backlog. Condition mirrors get_attendance_dashboard_rpc.sql's
-- pending_activity_rows CTE (approval_status = 'Pending', unbounded by
-- date -- the TRUE current backlog, per that RPC's own "Pass 4" fix).
--
-- Recipients deliberately mirror approve_attendance.sql/reject_attendance.sql's
-- own authorization model (superadmin, HR department, or the employee's
-- direct manager) -- who gets notified matches exactly who's actually
-- allowed to act, nothing more, nothing less.
--
-- Recurring reminder with a cooldown, not one-shot -- a pending approval is
-- a live queue, worth re-nagging about until someone approves/rejects it.
-- A 24-hour grace period before the first nag (clocked_in_at check) avoids
-- bothering anyone about a request that just came in and hasn't had a
-- normal chance to be actioned yet.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this system.
create or replace function public.check_attendance_approvals_pending()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row record;
begin
    for v_row in
        select
            aa.id,
            aa.employee_id,
            aa.clocked_in_at,
            e.full_name as employee_name,
            m.profile_id as manager_profile_id
        from public.attendance_activities aa
        join public.employees e on e.id = aa.employee_id
        left join public.employees m on m.id = e.manager_id
        where aa.approval_status = 'Pending'
          and aa.clocked_in_at < now() - interval '24 hours'
          and (aa.last_reminder_sent_at is null
               or aa.last_reminder_sent_at < now() - interval '24 hours')
    loop
        begin
            perform public.emit_notification_event(
                'attendance.approval_pending', 'attendance_activities', v_row.id::text,
                jsonb_build_object(
                    'activity_id', v_row.id,
                    'employee_id', v_row.employee_id,
                    'employee_name', v_row.employee_name,
                    'clocked_in_at', v_row.clocked_in_at,
                    'manager_profile_id', v_row.manager_profile_id,
                    'title', 'Attendance Approval Pending',
                    'message', format(
                        'An attendance approval request for %s has been pending for over 24 hours.',
                        v_row.employee_name
                    ),
                    'link_to', '/app/hr/attendance/list'
                )
            );

            update public.attendance_activities
                set last_reminder_sent_at = now()
                where id = v_row.id;
        exception when others then
            raise warning 'attendance approval reminder failed for activity %: %', v_row.id, sqlerrm;
        end;
    end loop;
end;
$$;

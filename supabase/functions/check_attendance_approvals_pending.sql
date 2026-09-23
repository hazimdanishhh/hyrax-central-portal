-- arguments: none
-- returns: void
--
-- Scheduled-scan reminder for attendance activities stuck in the pending-
-- approval backlog. Condition mirrors get_attendance_dashboard_rpc.sql's
-- pending_activity_rows CTE (approval_status = 'Pending', unbounded by
-- date -- the TRUE current backlog, per that RPC's own "Pass 4" fix).
--
-- ===========================================================================
-- CONSOLIDATED 2026-09-23 -- was one notification PER PENDING ACTIVITY ROW
-- ===========================================================================
-- The previous version looped over pending rows and emitted an event for each,
-- and every event fanned out to the employee's manager PLUS every HR manager
-- and staff profile. The multiplier was rows x recipients, and it was worse
-- than one-per-employee: create_attendance_backfill() deliberately routes
-- self-reconciliation rows here rather than emitting its own notification, so
-- a single employee fixing ten days of their own attendance produced TEN
-- Pending rows and therefore TEN separate notifications to every person in HR,
-- 24 hours later, repeating every day until someone actioned them.
--
-- Now: ONE notification per manager, and ONE company-wide digest for HR. Same
-- shape as check_tasks_due_soon.sql, which was refactored the same way for the
-- same reason -- group by recipient, carry a count, and link to a FILTERED
-- LIST rather than to a single record.
--
-- TWO event types rather than one, because the recipients need different links
-- and an event carries a single link_to. A manager goes to their own Team
-- Attendance list; HR goes to the HR Attendance list. The old version sent
-- everyone the bare HR path -- including managers, who have no HR route
-- access, so it was a dead link for most recipients.
--
-- Both links filter on approvalState=pending, the approval axis column, so the
-- page opens showing exactly the rows the notification is about. The old link
-- carried no filter at all, leaving the recipient to go and find them.
--
-- ===========================================================================
-- Recipients deliberately mirror approve_attendance.sql/reject_attendance.sql's
-- own authorization model (superadmin, HR department, or the employee's
-- direct manager) -- who gets notified matches exactly who is actually
-- allowed to act, nothing more, nothing less.
--
-- Recurring reminder with a cooldown, not one-shot -- a pending approval is a
-- live queue, worth re-nagging about until someone approves or rejects it. The
-- 24-hour grace period before the first nag (the clocked_in_at test) avoids
-- bothering anyone about a request that has not had a normal chance to be
-- actioned yet.
--
-- The cooldown is still stamped PER ROW even though the notification is now
-- per recipient -- same as check_tasks_due_soon.sql. Stamping per recipient
-- would let a row belonging to two recipient sets (it always does: one manager
-- and HR) be cleared by whichever fired first, silently suppressing the other.
--
-- ORDER MATTERS BELOW. Both emissions run against the same eligible set and
-- the stamp happens once, at the end. now() is the transaction timestamp and
-- last_reminder_sent_at does not change until that final UPDATE, so the
-- predicate selects an identical set all three times.
--
-- SECURITY DEFINER + set search_path = '': runs under pg_cron with no calling
-- user session at all, same as every other check_* function in this system.
create or replace function public.check_attendance_approvals_pending()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_manager      record;
    v_hr_rows      integer;
    v_hr_employees integer;
begin
    -- 1. ONE PER MANAGER, covering every pending row across their reports.
    for v_manager in
        select m.id                           as manager_id,
               m.profile_id                   as manager_profile_id,
               count(*)                       as pending_count,
               count(distinct aa.employee_id) as employee_count
        from public.attendance_activities aa
        join public.employees e on e.id = aa.employee_id
        join public.employees m on m.id = e.manager_id
        where aa.approval_status = 'Pending'
          and aa.clocked_in_at < now() - interval '24 hours'
          and (aa.last_reminder_sent_at is null
               or aa.last_reminder_sent_at < now() - interval '24 hours')
          and m.profile_id is not null
        group by m.id, m.profile_id
    loop
        begin
            perform public.emit_notification_event(
                'attendance.approval_pending_manager',
                'employees',
                v_manager.manager_id::text,
                jsonb_build_object(
                    'manager_profile_id', v_manager.manager_profile_id,
                    'pending_count', v_manager.pending_count,
                    'employee_count', v_manager.employee_count,
                    'title', 'Attendance Approvals Pending',
                    'message', format(
                        '%s attendance record%s from %s of your team member%s %s waiting for your approval.',
                        v_manager.pending_count,
                        case when v_manager.pending_count = 1 then '' else 's' end,
                        v_manager.employee_count,
                        case when v_manager.employee_count = 1 then '' else 's' end,
                        case when v_manager.pending_count = 1 then 'is' else 'are' end
                    ),
                    'link_to', '/app/employee/team-attendance/list?approvalState=pending'
                )
            );
        exception when others then
            raise warning 'attendance.approval_pending_manager failed for manager %: %',
                v_manager.manager_id, sqlerrm;
        end;
    end loop;

    -- 2. ONE COMPANY-WIDE DIGEST FOR HR. Not per employee, not per row -- HR
    -- works this as a queue, so it wants a count and a way into it.
    select count(*), count(distinct aa.employee_id)
      into v_hr_rows, v_hr_employees
    from public.attendance_activities aa
    where aa.approval_status = 'Pending'
      and aa.clocked_in_at < now() - interval '24 hours'
      and (aa.last_reminder_sent_at is null
           or aa.last_reminder_sent_at < now() - interval '24 hours');

    -- Silent when the queue is empty rather than sending "0 pending" -- same
    -- early exit as send_payroll_reconciliation_hr_digest.sql.
    if coalesce(v_hr_rows, 0) > 0 then
        begin
            perform public.emit_notification_event(
                'attendance.approval_pending_hr',
                'attendance_activities',
                'digest',
                jsonb_build_object(
                    'pending_count', v_hr_rows,
                    'employee_count', v_hr_employees,
                    'title', 'Attendance Approvals Pending',
                    'message', format(
                        '%s attendance record%s across %s employee%s %s waiting for approval.',
                        v_hr_rows,
                        case when v_hr_rows = 1 then '' else 's' end,
                        v_hr_employees,
                        case when v_hr_employees = 1 then '' else 's' end,
                        case when v_hr_rows = 1 then 'is' else 'are' end
                    ),
                    'link_to', '/app/hr/attendance/list?approvalState=pending'
                )
            );
        exception when others then
            raise warning 'attendance.approval_pending_hr digest failed: %', sqlerrm;
        end;
    end if;

    -- 3. Stamp the cooldown ONCE, on every row both emissions covered.
    update public.attendance_activities aa
       set last_reminder_sent_at = now()
     where aa.approval_status = 'Pending'
       and aa.clocked_in_at < now() - interval '24 hours'
       and (aa.last_reminder_sent_at is null
            or aa.last_reminder_sent_at < now() - interval '24 hours');
end;
$$;

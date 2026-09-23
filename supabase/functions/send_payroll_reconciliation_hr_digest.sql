-- arguments: none
-- returns: void
--
-- HR/superadmin-facing weekly summary of outstanding-flag counts for the
-- previous calendar month, so HR has visibility without opening Payroll
-- Export manually. Independently re-derives its own aggregate rather than
-- sharing state with send_payroll_reconciliation_notifications() across
-- the same cron job body -- keeps the two decoupled and safe to
-- reorder/re-run independently. Skips entirely when nothing is
-- outstanding.
--
-- Goes through the generic notification_rules pipeline -- correct here,
-- unlike the employee-facing notifications, because HR/superadmin
-- recipients always have a profiles row (portal accounts by definition).
-- Channel is in_app ONLY for now -- email intentionally deferred, see
-- docs/PAYROLL-DATA-REQUIREMENTS.md's "Planned: automated email" appendix;
-- flip the notification_rules row's channels to include 'email' once the
-- app is out of testing, no code change needed here.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function. No auth.uid() guard, same reasoning as
-- send_payroll_reconciliation_notifications() -- no caller-supplied
-- target, worst case of an early trigger is HR seeing this slightly early.
create or replace function public.send_payroll_reconciliation_hr_digest()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_today_myt    date;
    v_period_start date;
    v_period_end   date;
    v_flagged_employee_count      integer;
    v_absent_count                integer;
    v_leave_conflict_count        integer;
    v_insufficient_half_day_count integer;
    v_leave_fraction_error_count  integer;
    v_unreachable_count           integer;
begin
    begin
        v_today_myt := (now() at time zone 'Asia/Kuala_Lumpur')::date;
        v_period_start := (date_trunc('month', v_today_myt) - interval '1 month')::date;
        v_period_end   := (date_trunc('month', v_today_myt) - interval '1 day')::date;

        with period_rows as materialized (
            select uda.employee_uuid, uda.work_date, uda.day_state, uda.is_weekend,
                   uda.is_public_holiday,
                   uda.is_leave_attendance_conflict, uda.is_insufficient_half_day_hours,
                   uda.has_leave_fraction_error
            from public.unified_daily_attendance uda
            where uda.work_date >= v_period_start and uda.work_date <= v_period_end
        ),
        -- Already-resolved flags. This digest computes has_absent /
        -- has_insufficient_half_day directly from the view rather than through
        -- get_payroll_reconciliation_rows(), so it needs its own copy of the
        -- suppression -- otherwise HR's weekly digest would keep reporting
        -- outstanding counts for days that have been acknowledged and no longer
        -- appear in the drilldown, the email, or the employee's own reminder.
        acknowledged as (
            select ack.employee_id, ack.work_date, ack.category
            from public.attendance_reconciliation_acknowledgements ack
            where ack.work_date >= v_period_start and ack.work_date <= v_period_end
        ),
        flagged as (
            select
                p.employee_uuid,
                bool_or(
                    p.day_state = 'absent'
                    and not exists (
                        select 1 from acknowledged a
                        where a.employee_id = p.employee_uuid
                          and a.work_date = p.work_date
                          and a.category = 'absent'
                    )
                ) as has_absent,
                bool_or(p.is_leave_attendance_conflict) as has_leave_conflict,
                bool_or(
                    p.is_insufficient_half_day_hours
                    and not exists (
                        select 1 from acknowledged a
                        where a.employee_id = p.employee_uuid
                          and a.work_date = p.work_date
                          and a.category = 'insufficient_half_day'
                    )
                ) as has_insufficient_half_day,
                bool_or(p.has_leave_fraction_error) as has_leave_fraction_error
            from period_rows p
            group by p.employee_uuid
        ),
        flagged_with_email as (
            select f.*, coalesce(e.email_work, e.email_personal) as resolved_email
            from flagged f
            join public.employees e on e.id = f.employee_uuid
            where f.has_absent or f.has_leave_conflict or f.has_insufficient_half_day or f.has_leave_fraction_error
        )
        select
            count(*),
            count(*) filter (where has_absent),
            count(*) filter (where has_leave_conflict),
            count(*) filter (where has_insufficient_half_day),
            count(*) filter (where has_leave_fraction_error),
            count(*) filter (where resolved_email is null)
        into v_flagged_employee_count, v_absent_count, v_leave_conflict_count,
             v_insufficient_half_day_count, v_leave_fraction_error_count, v_unreachable_count
        from flagged_with_email;

        if coalesce(v_flagged_employee_count, 0) = 0 then
            return;
        end if;

        perform public.emit_notification_event(
            'payroll.reconciliation_digest_weekly', 'payroll_period', v_period_start::text,
            jsonb_build_object(
                'period_start', v_period_start,
                'period_end', v_period_end,
                'title', 'Weekly Payroll Reconciliation Digest',
                'message', format(
                    '%s employee(s) still have unresolved attendance flags for %s to %s (%s absent, %s leave conflicts, %s insufficient half-day, %s leave data errors)%s.',
                    v_flagged_employee_count, to_char(v_period_start, 'DD Mon YYYY'), to_char(v_period_end, 'DD Mon YYYY'),
                    v_absent_count, v_leave_conflict_count, v_insufficient_half_day_count, v_leave_fraction_error_count,
                    case when v_unreachable_count > 0
                         then format(' — %s of them have no work/personal email on file and would need manual outreach even once automated email is enabled', v_unreachable_count)
                         else '' end
                ),
                'link_to', format(
                    '/app/hr/attendance/payroll-export?startDate=%s&endDate=%s',
                    to_char(v_period_start, 'YYYY-MM-DD'), to_char(v_period_end, 'YYYY-MM-DD')
                )
            )
        );
    exception when others then
        raise warning 'payroll reconciliation HR digest failed: %', sqlerrm;
    end;
end;
$$;

-- arguments: none
-- returns: void
--
-- Weekly, in-app-only reminder for outstanding payroll reconciliation
-- flags, for the most recently COMPLETED calendar month. Deliberately
-- scoped to in-app only, and only to employees with a linked profiles row
-- -- the app is still in testing, not company-wide, so automated bulk
-- EMAIL to real employee addresses is intentionally NOT built here; see
-- docs/PAYROLL-DATA-REQUIREMENTS.md's "Planned: automated email" appendix
-- for the full deferred design, ready to build once the app is out of
-- testing. The existing manual "Send Email" button
-- (queue_payroll_reconciliation_email_rpc.sql) is untouched and still the
-- only way an email actually goes out for this feature.
--
-- One notification per (employee, category) -- never one combined
-- notification -- so each flag type ("Absent", "Leave Conflict",
-- "Insufficient Half-Day Hours", "Leave Data Error") carries its own deep
-- link scoped to exactly that flag's filter, and a category with zero
-- flagged days for that employee never fires at all.
--
-- No auth.uid() guard -- mirrors check_attendance_approvals_pending.sql's
-- own precedent: this function takes no caller-supplied target and
-- returns nothing to its caller, so even a direct manual trigger by any
-- authenticated user can, at worst, re-notify legitimate recipients of
-- their own already-correct data slightly early -- never a leak. This is
-- also why the 4-category predicate is duplicated inline here rather than
-- calling into get_payroll_reconciliation_rows() (guarded, and that guard
-- always fails under pg_cron since auth.uid() is null there).
--
-- Cooldown: checks notification_events directly (not
-- payroll_reconciliation_email_sends, which is an EMAIL audit table this
-- function never writes to) for an existing
-- payroll.reconciliation_outstanding event for this employee+category+
-- period within the last 6 days, before emitting a new one.
--
-- Backing notification_rules row (seed_payroll_reconciliation_notification_
-- rules.sql) is in_app ONLY.
--
-- Wrapped per-employee in its own exception block so one bad row never
-- stops the batch.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this schema.
create or replace function public.send_payroll_reconciliation_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_today_myt      date;
    v_period_start   date;
    v_period_end     date;
    v_row            record;
    v_code           text;
    v_count          integer;
    v_glossary_label text;
    v_glossary_description text;
    v_category_query_params text;
    v_category_order constant text[] := array['absent', 'leave_conflict', 'insufficient_half_day', 'leave_fraction_error'];
begin
    v_today_myt := (now() at time zone 'Asia/Kuala_Lumpur')::date;
    v_period_start := (date_trunc('month', v_today_myt) - interval '1 month')::date;
    v_period_end   := (date_trunc('month', v_today_myt) - interval '1 day')::date;

    for v_row in
        select e.id as employee_id, e.profile_id as employee_profile_id
        from public.employees e
        where e.profile_id is not null
    loop
        begin
            foreach v_code in array v_category_order
            loop
                select count(*)
                into v_count
                from public.unified_daily_attendance r
                where r.employee_uuid = v_row.employee_id
                  and r.work_date >= v_period_start
                  and r.work_date <= v_period_end
                  and (
                    (v_code = 'absent' and r.hr_flag = 'Absent' and not r.is_weekend and not r.is_public_holiday)
                    or (v_code = 'leave_conflict' and r.is_leave_attendance_conflict)
                    or (v_code = 'insufficient_half_day' and r.is_insufficient_half_day_hours)
                    or (v_code = 'leave_fraction_error' and r.has_leave_fraction_error)
                  );

                continue when coalesce(v_count, 0) = 0;

                if exists (
                    select 1 from public.notification_events ne
                    where ne.event_type = 'payroll.reconciliation_outstanding'
                      and ne.payload ->> 'employee_id' = v_row.employee_id::text
                      and ne.payload ->> 'category' = v_code
                      and (ne.payload ->> 'period_start')::date = v_period_start
                      and ne.created_at > now() - interval '6 days'
                ) then
                    continue;
                end if;

                select g.label, g.description
                into v_glossary_label, v_glossary_description
                from public.payroll_reconciliation_glossary g
                where g.code = v_code and g.is_active;

                v_category_query_params := case v_code
                    when 'absent' then 'hrFlag=Absent&dayType=working'
                    when 'leave_conflict' then 'leaveAttendanceConflict=true'
                    when 'insufficient_half_day' then 'insufficientHalfDayHours=true'
                    when 'leave_fraction_error' then 'leaveFractionError=true'
                end;

                perform public.emit_notification_event(
                    'payroll.reconciliation_outstanding', 'employees', v_row.employee_id::text,
                    jsonb_build_object(
                        'employee_id', v_row.employee_id,
                        'employee_profile_id', v_row.employee_profile_id,
                        'category', v_code,
                        'period_start', v_period_start,
                        'period_end', v_period_end,
                        'title', coalesce(v_glossary_label, v_code) || ' — Reconciliation Needed',
                        'message', format(
                            '%s day%s flagged (%s) for %s to %s. %s',
                            v_count, case when v_count = 1 then '' else 's' end,
                            coalesce(v_glossary_label, v_code),
                            to_char(v_period_start, 'DD Mon YYYY'), to_char(v_period_end, 'DD Mon YYYY'),
                            coalesce(v_glossary_description, '')
                        ),
                        'link_to', format(
                            '/app/employee/attendance/list?%s&startDate=%s&endDate=%s',
                            v_category_query_params,
                            to_char(v_period_start, 'YYYY-MM-DD'), to_char(v_period_end, 'YYYY-MM-DD')
                        )
                    )
                );
            end loop;
        exception when others then
            raise warning 'payroll reconciliation notification failed for employee %: %', v_row.employee_id, sqlerrm;
        end;
    end loop;
end;
$$;

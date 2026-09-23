-- arguments: none
-- returns: void
--
-- Weekly, in-app-only reminder for outstanding payroll reconciliation flags,
-- for the most recently COMPLETED calendar month. Deliberately scoped to
-- in-app only, and only to employees with a linked profiles row -- the app is
-- still in testing, not company-wide, so automated bulk EMAIL to real employee
-- addresses is intentionally NOT built here; see
-- docs/PAYROLL-DATA-REQUIREMENTS.md's "Planned: automated email" appendix for
-- the full deferred design. The manual "Send Email" button
-- (queue_payroll_reconciliation_email_rpc.sql) is untouched and still the only
-- way an email actually goes out for this feature.
--
-- ===========================================================================
-- CONSOLIDATED 2026-09-23 -- was one notification PER (EMPLOYEE, CATEGORY)
-- ===========================================================================
-- The previous version looped over every employee and then over four
-- categories, emitting a separate notification for each non-empty one -- up to
-- four per employee per week. The stated reason was that each flag could then
-- carry its own deep link scoped to that flag.
--
-- That reason no longer holds. "Needs Reconciliation" is now a single filter
-- covering every unresolved category, so ONE link opens exactly the set the
-- notification is about. The categories are named in the message instead,
-- which is more useful than four separate notifications: the employee sees at
-- a glance that they have two absences AND a leave conflict, rather than
-- receiving two notifications an hour apart and having to assemble that
-- themselves.
--
-- It is also far cheaper. The old shape ran one scalar COUNT against
-- unified_daily_attendance per employee per category -- four queries against
-- an expensive view for every employee in the company, every week. This runs
-- one grouped aggregate.
--
-- ===========================================================================
-- FIXES: acknowledged days were nagging forever
-- ===========================================================================
-- The absent branch counted `day_state = 'absent'` and the half-day branch
-- counted `is_insufficient_half_day_hours` -- the RAW flags, with no
-- acknowledgement check. So an employee who had already acknowledged an
-- absence, or whose half-day had already been reviewed and accepted by HR,
-- kept being reminded about it every week, indefinitely, with no way to make
-- it stop. Acknowledging is the mechanism that exists precisely to close these,
-- and this function ignored it.
--
-- Now reads is_unacknowledged_absent / is_unacknowledged_insufficient_half_day,
-- the acknowledgement-aware columns, so closing a day actually closes it. The
-- other two categories have no acknowledged variant because they are not
-- acknowledgeable -- they clear themselves when the HR2000 leave ledger is
-- corrected and re-synced.
--
-- ===========================================================================
-- DELIBERATELY EXCLUDES pending-approval days
-- ===========================================================================
-- needs_reconciliation also covers hours sitting on unapproved app activities.
-- Those are NOT counted here: the employee cannot approve their own entry, so
-- reminding them about it is asking them to do something they have no power to
-- do. That category is chased through check_attendance_approvals_pending(),
-- which goes to the manager and HR -- the people who can actually act.
--
-- The link still opens the full Needs Reconciliation view, so if such days
-- exist the employee can see them; they are just not what the reminder counts.
--
-- ===========================================================================
-- No auth.uid() guard -- mirrors check_attendance_approvals_pending.sql's own
-- precedent: this function takes no caller-supplied target and returns nothing
-- to its caller, so even a direct manual trigger by any authenticated user can
-- at worst re-notify legitimate recipients about their own already-correct
-- data slightly early -- never a leak. This is also why the predicate is
-- inline here rather than calling get_payroll_reconciliation_rows(), which is
-- guarded, and whose guard always fails under pg_cron since auth.uid() is null
-- there.
--
-- Cooldown: checks notification_events directly (not
-- payroll_reconciliation_email_sends, an EMAIL audit table this function never
-- writes to) for an existing event for this employee and period within the
-- last 6 days. Now keyed on (employee, period) rather than
-- (employee, category, period), since there is one notification per employee.
--
-- Backing notification_rules row (seed_payroll_reconciliation_notification_
-- rules.sql) is in_app ONLY.
--
-- Wrapped per-employee in its own exception block so one bad row never stops
-- the batch.
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
    v_today_myt    date;
    v_period_start date;
    v_period_end   date;
    v_row          record;
    v_parts        text[];
    v_label        text;
begin
    v_today_myt    := (now() at time zone 'Asia/Kuala_Lumpur')::date;
    v_period_start := (date_trunc('month', v_today_myt) - interval '1 month')::date;
    v_period_end   := (date_trunc('month', v_today_myt) - interval '1 day')::date;

    -- One row per employee who has anything outstanding, with a per-category
    -- breakdown. day_count counts DAYS, not flags -- a single day can carry
    -- more than one category (a leave data error alongside a conflict, say),
    -- and "3 days need your attention" must not become 4 because one of them
    -- was doubly flagged.
    for v_row in
        select
            r.employee_uuid                                                as employee_id,
            e.profile_id                                                   as employee_profile_id,
            count(*) filter (where r.is_unacknowledged_absent)             as absent_count,
            count(*) filter (where r.is_leave_attendance_conflict)         as conflict_count,
            count(*) filter (where r.is_unacknowledged_insufficient_half_day) as half_day_count,
            count(*) filter (where r.has_leave_fraction_error)             as leave_error_count,
            count(*)                                                       as day_count
        from public.unified_daily_attendance r
        join public.employees e on e.id = r.employee_uuid
        where r.work_date >= v_period_start
          and r.work_date <= v_period_end
          and e.profile_id is not null
          and (
                r.is_unacknowledged_absent
             or r.is_leave_attendance_conflict
             or r.is_unacknowledged_insufficient_half_day
             or r.has_leave_fraction_error
          )
        group by r.employee_uuid, e.profile_id
    loop
        begin
            if exists (
                select 1 from public.notification_events ne
                where ne.event_type = 'payroll.reconciliation_outstanding'
                  and ne.payload ->> 'employee_id' = v_row.employee_id::text
                  and (ne.payload ->> 'period_start')::date = v_period_start
                  and ne.created_at > now() - interval '6 days'
            ) then
                continue;
            end if;

            -- Human-readable breakdown, only mentioning categories that
            -- actually have days. Labels come from payroll_reconciliation_
            -- glossary so the wording matches what the Payroll Export page and
            -- the acknowledgement dialog call each category -- three surfaces,
            -- one vocabulary.
            v_parts := array[]::text[];

            if v_row.absent_count > 0 then
                select g.label into v_label
                from public.payroll_reconciliation_glossary g
                where g.code = 'absent' and g.is_active;
                v_parts := v_parts || format('%s %s', v_row.absent_count, coalesce(v_label, 'absent'));
            end if;

            if v_row.conflict_count > 0 then
                select g.label into v_label
                from public.payroll_reconciliation_glossary g
                where g.code = 'leave_conflict' and g.is_active;
                v_parts := v_parts || format('%s %s', v_row.conflict_count, coalesce(v_label, 'leave conflict'));
            end if;

            if v_row.half_day_count > 0 then
                select g.label into v_label
                from public.payroll_reconciliation_glossary g
                where g.code = 'insufficient_half_day' and g.is_active;
                v_parts := v_parts || format('%s %s', v_row.half_day_count, coalesce(v_label, 'insufficient half-day'));
            end if;

            if v_row.leave_error_count > 0 then
                select g.label into v_label
                from public.payroll_reconciliation_glossary g
                where g.code = 'leave_fraction_error' and g.is_active;
                v_parts := v_parts || format('%s %s', v_row.leave_error_count, coalesce(v_label, 'leave data error'));
            end if;

            perform public.emit_notification_event(
                'payroll.reconciliation_outstanding', 'employees', v_row.employee_id::text,
                jsonb_build_object(
                    'employee_id', v_row.employee_id,
                    'employee_profile_id', v_row.employee_profile_id,
                    'period_start', v_period_start,
                    'period_end', v_period_end,
                    'day_count', v_row.day_count,
                    'absent_count', v_row.absent_count,
                    'conflict_count', v_row.conflict_count,
                    'half_day_count', v_row.half_day_count,
                    'leave_error_count', v_row.leave_error_count,
                    'title', 'Attendance Needs Your Attention',
                    'message', format(
                        '%s day%s from %s to %s need%s your attention: %s.',
                        v_row.day_count,
                        case when v_row.day_count = 1 then '' else 's' end,
                        to_char(v_period_start, 'DD Mon YYYY'),
                        to_char(v_period_end, 'DD Mon YYYY'),
                        case when v_row.day_count = 1 then 's' else '' end,
                        array_to_string(v_parts, ', ')
                    ),
                    -- One link covering every category, which is what made the
                    -- consolidation possible. needsReconciliation is a real
                    -- server-side filter on the view, acknowledgement-aware, so
                    -- the page opens on exactly the outstanding days -- and a
                    -- day closed between the notification being sent and the
                    -- employee clicking it simply will not be there.
                    'link_to', format(
                        '/app/employee/attendance/list?needsReconciliation=true&startDate=%s&endDate=%s',
                        to_char(v_period_start, 'YYYY-MM-DD'),
                        to_char(v_period_end, 'YYYY-MM-DD')
                    )
                )
            );
        exception when others then
            raise warning 'payroll reconciliation notification failed for employee %: %',
                v_row.employee_id, sqlerrm;
        end;
    end loop;
end;
$$;

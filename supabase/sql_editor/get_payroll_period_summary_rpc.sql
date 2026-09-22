-- get_payroll_period_summary: backs the HR "Payroll Export" tab
-- (src/pages/user/hr/attendanceManagement/payrollExport/PayrollExport.jsx).
--
-- The "Payroll Period Summary" from docs/PAYROLL-DATA-REQUIREMENTS.md's
-- phasing section: one row per active employee, per selected cycle --
-- hours worked, overtime, absences, holiday/weekend work (hours AND day
-- counts), paid/unpaid leave days, and every unresolved reconciliation flag
-- -- everything this app can correctly and reliably compute today, for HR
-- to hand off to whatever actually calculates and disburses pay. This is
-- the row-level export itself, not a company-wide KPI aggregate (contrast
-- get_attendance_dashboard_rpc.sql, which this mirrors structurally but
-- collapses to scalars instead of one row per employee).
--
-- GROUP BY employee_uuid, not full_name -- get_attendance_dashboard_rpc.sql's
-- own topOvertimeData/topAbsenteeismData group by full_name, which silently
-- merges two employees who happen to share a name. Payroll data must never
-- do that, so this RPC groups by the real identity column throughout.
--
-- Every source column already exists on unified_daily_attendance/
-- leave_ledger_entries -- no new view/table columns needed (2026-09-15
-- addition: estimatedNormalDayOtHoursTotal/estimatedRestDay*/
-- estimatedHolidayFullTierDaysCount/estimatedHolidayExcessHoursTotal below
-- are a straight sum/count over unified_daily_attendance's own new
-- statutory rate-tier ESTIMATE columns -- see that view's header comment
-- on them, and docs/PAYROLL-DATA-REQUIREMENTS.md -- still no new source
-- table). period_rows is
-- materialized for the same reason get_attendance_dashboard_rpc.sql
-- materializes it (unified_daily_attendance is expensive; this CTE is read
-- twice below).
--
-- HR/superadmin only -- no self-service branch (unlike
-- get_attendance_dashboard_rpc.sql), since this only ever powers the
-- HR-only Payroll Export tab (AccessRoute departments=["HR"]).
--
-- totalWorkingDaysCount/actualDaysWorkedCount (added for the row-click
-- reconciliation sidebar, PayrollReconciliationSidebar.jsx): the scheduled
-- calendar workdays for the period (not weekend, not public holiday) and,
-- of those, how many the employee actually has real attendance for.
-- Reconciliation identity HR can sanity-check on screen: roughly
-- totalWorkingDaysCount = actualDaysWorkedCount + daysAbsentCount +
-- paidLeaveDaysTotal + unpaidLeaveDaysTotal -- "roughly", not exactly, for
-- one concrete, traced reason: a half-day (0.5) leave logged with ZERO
-- attendance that day makes hr_flag read 'On Leave (...)', not 'Absent'
-- (see hr_unified_daily_attendance_view.sql's hr_flag CASE expression), so
-- that day contributes 1 to totalWorkingDaysCount, 0 to
-- actualDaysWorkedCount, 0 to daysAbsentCount, and only 0.5 to
-- paidLeaveDaysTotal/unpaidLeaveDaysTotal combined -- a real 0.5-day gap in
-- the identity, and exactly what is_insufficient_half_day_hours already
-- exists to flag separately. Not something to "fix" into being exact.
--
-- Deliberately NOT bounded by employee join_date/end_date -- see this
-- file's own daysAbsentCount, which has never been bounded by it either
-- (unified_daily_attendance's expected_shifts CTE has no such bound today
-- for ANY consumer); bounding only these two new columns would make the
-- reconciliation identity worse for a mid-period joiner/leaver, not
-- better, so this intentionally inherits the same pre-existing behavior
-- rather than a new one. A real fix belongs in the view itself, out of
-- scope here.
--
-- resolvedEmail/emailSource: the address the "Send Email" flow
-- (queue_payroll_reconciliation_email_rpc.sql) would actually use --
-- coalesce(email_work, email_personal), surfaced here so
-- PayrollReconciliationSidebar.jsx can gate/disable Send and show which
-- address was used without a second round trip. Both are nullable --
-- resolvedEmail/emailSource are null when both are blank, which the
-- frontend must treat as "no email on file," never a silent failure.
-- p_work_location_id added 2026-09 -- unified_daily_attendance/employees
-- both already carry work_location_id, this just exposes it as a filter
-- (PayrollExport.jsx's filterConfig.js previously noted this parameter
-- didn't exist yet).
create or replace function get_payroll_period_summary(
    p_start_date       date,
    p_end_date         date,
    p_department_id    bigint default null,
    p_employee_id      uuid default null,
    p_work_location_id bigint default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_is_hr_or_superadmin boolean;
begin

-- Authorization guard -- mirrors get_attendance_dashboard_rpc.sql's guard
-- (same root cause: unified_daily_attendance has no security_invoker, so
-- RLS on the underlying tables never applies through it). No self-scoped
-- exception here -- this RPC is HR/superadmin only, full stop.
select (public.is_superadmin() or p.department_id = 7)
into v_is_hr_or_superadmin
from public.profiles p
where p.id = auth.uid();

if not coalesce(v_is_hr_or_superadmin, false) then
    raise exception 'Unauthorized: get_payroll_period_summary requires HR/superadmin' using errcode = '42501';
end if;

if p_start_date is null or p_end_date is null then
    raise exception 'get_payroll_period_summary requires both p_start_date and p_end_date' using errcode = '22004';
end if;

with period_rows as materialized (
    select uda.*
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and uda.work_date >= p_start_date
    and uda.work_date <= p_end_date
),

-- HR2000 leave ledger integration -- mirrors
-- get_attendance_dashboard_rpc.sql's employee_leave_rows exactly (joined
-- directly to leave_ledger_types, not unified_daily_attendance's per-day
-- collapsed leave_type_codes string, so a multi-leave-type day's paid/
-- unpaid split stays accurate).
employee_leave_rows as (
    select
        le.employee_id as leave_emp_uuid,
        le.day_fraction,
        -- CAVEAT (same as get_attendance_dashboard_rpc.sql): is_paid is an
        -- unconfirmed guess for nearly every leave type today
        -- (leave_ledger_types.needs_hr_confirmation), pending real HR/
        -- payroll sign-off.
        lt.is_paid
    from leave_ledger_entries le
    join leave_ledger_types lt on lt.id = le.leave_type_id
    join employees e on e.id = le.employee_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or le.employee_id = p_employee_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
    and le.leave_date >= p_start_date
    and le.leave_date <= p_end_date
),

-- Reconciliation flags that have already been reviewed and closed.
--
-- These do NOT reduce days_absent_count below -- the employee WAS absent and
-- payroll still deducts an unpaid day. Acknowledging closes the REVIEW, not the
-- FACT. What it feeds is the parallel unacknowledged_* counts, which are what
-- the Payroll Export row-flag badge and the "Needs Reconciliation" filter read.
-- Collapsing the two would silently under-report unpaid days to payroll.
period_acknowledgements as (
    select ack.employee_id, ack.work_date, ack.category
    from attendance_reconciliation_acknowledgements ack
    where ack.work_date >= p_start_date
      and ack.work_date <= p_end_date
),

attendance_summary as (
    select
        -- Qualified: this CTE now LEFT JOINs the acknowledgements, so bare
        -- column names are only safe where the name is unique across all three
        -- relations. employee_uuid is (the acks table uses employee_id), but
        -- being explicit costs nothing and survives a future column addition.
        period_rows.employee_uuid,
        max(company_employee_code) as company_employee_code,
        max(full_name) as full_name,
        max(department_name) as department_name,
        -- Payroll-eligible (Approved-only) hours -- see
        -- hr_unified_daily_attendance_view.sql's approved_app_hours/
        -- approved_hours_worked/approved_overtime_hours own comments. Sourced
        -- from approved_hours_worked/approved_overtime_hours, NOT the raw
        -- hours_worked/overtime_hours (those stay Pending-inclusive for every
        -- other consumer of this view -- dashboards, attendance rate, etc.).
        round(sum(approved_hours_worked)::numeric, 2) as hours_worked_total,
        round(sum(approved_overtime_hours)::numeric, 2) as overtime_hours_total,
        round(sum(pending_approval_hours)::numeric, 2) as pending_approval_hours_total,
        -- Mirrors PAYROLL-DATA-REQUIREMENTS.md's own documented-correct
        -- "Days absent" definition -- hr_flag = 'Absent' alone overcounts
        -- unworked weekends/holidays, both of which also read 'Absent'.
        count(*) filter (where hr_flag = 'Absent' and not is_weekend and not is_public_holiday) as days_absent_count,
        -- Scheduled calendar workdays this period -- see this file's own
        -- header comment for the reconciliation identity and its one
        -- documented, expected gap source.
        count(*) filter (where not is_weekend and not is_public_holiday) as total_working_days_count,
        -- Of those scheduled workdays, how many the employee actually has
        -- real attendance for -- every hr_flag value except 'Absent' and
        -- 'On Leave (...)'.
        count(*) filter (
            where not is_weekend and not is_public_holiday
            and hr_flag in ('OK', 'Approved', 'Pending App Approval', 'Missing App Check-Out', 'Incomplete Card Scans')
        ) as actual_days_worked_count,
        count(*) filter (where is_worked_on_holiday) as holiday_days_worked_count,
        -- Approved-only sum (see hours_worked_total's own comment above) --
        -- is_worked_on_holiday itself stays existence-based/unchanged (a real
        -- check-in happened, regardless of approval), only the HOURS summed
        -- switch to the approved-only column.
        round(sum(approved_holiday_hours_worked) filter (where is_worked_on_holiday)::numeric, 2) as holiday_hours_worked_total,
        count(*) filter (where is_worked_on_weekend) as weekend_days_worked_count,
        round(sum(approved_weekend_hours_worked) filter (where is_worked_on_weekend)::numeric, 2) as weekend_hours_worked_total,
        count(*) filter (where is_leave_attendance_conflict) as leave_attendance_conflict_count,
        count(*) filter (where is_insufficient_half_day_hours) as insufficient_half_day_hours_count,
        -- OUTSTANDING (not yet acknowledged) counterparts of the two
        -- acknowledgeable flags. The counts above stay whole for payroll; these
        -- drive the reconciliation UI.
        count(*) filter (
            where hr_flag = 'Absent' and not is_weekend and not is_public_holiday
              and ack_absent.employee_id is null
        ) as unacknowledged_absence_count,
        -- CONFIRMED (already reviewed) counterpart -- same base predicate as
        -- days_absent_count, just the opposite acknowledgement direction from
        -- unacknowledged_absence_count above. acknowledged_absence_count +
        -- unacknowledged_absence_count = days_absent_count, always -- surfaced
        -- explicitly so Payroll Export can show HR the split instead of
        -- leaving "how many of these Days Absent are actually confirmed"
        -- invisible.
        count(*) filter (
            where hr_flag = 'Absent' and not is_weekend and not is_public_holiday
              and ack_absent.employee_id is not null
        ) as acknowledged_absence_count,
        count(*) filter (
            where is_insufficient_half_day_hours
              and ack_half_day.employee_id is null
        ) as unacknowledged_insufficient_half_day_count,
        count(*) filter (where has_leave_fraction_error) as leave_fraction_error_count,
        -- Statutory rate-tier ESTIMATE (see hr_unified_daily_attendance_view.sql's
        -- own header comment on these columns, added 2026-09-15) -- for
        -- reconciliation against the real, claims-module-driven "actuals"
        -- once that's built, never itself the payable figure.
        round(sum(estimated_normal_day_ot_hours)::numeric, 2) as estimated_normal_day_ot_hours_total,
        count(*) filter (where rest_day_wage_tier = 'half_day') as estimated_rest_day_half_tier_days_count,
        count(*) filter (where rest_day_wage_tier = 'full_day') as estimated_rest_day_full_tier_days_count,
        round(sum(rest_day_excess_hours)::numeric, 2) as estimated_rest_day_excess_hours_total,
        count(*) filter (where holiday_wage_tier = 'full_day') as estimated_holiday_full_tier_days_count,
        round(sum(holiday_excess_hours)::numeric, 2) as estimated_holiday_excess_hours_total
    from period_rows
    -- LEFT JOINed rather than tested with a correlated subquery inside the
    -- FILTER clauses above: a plain "did this join match" boolean is simpler to
    -- read and unambiguously valid there. One row at most per join, guaranteed
    -- by the table's unique (employee_id, work_date, category).
    left join period_acknowledgements ack_absent
        on ack_absent.employee_id = period_rows.employee_uuid
       and ack_absent.work_date = period_rows.work_date
       and ack_absent.category = 'absent'
    left join period_acknowledgements ack_half_day
        on ack_half_day.employee_id = period_rows.employee_uuid
       and ack_half_day.work_date = period_rows.work_date
       and ack_half_day.category = 'insufficient_half_day'
    group by period_rows.employee_uuid
),

leave_summary as (
    select
        leave_emp_uuid,
        coalesce(sum(day_fraction) filter (where is_paid), 0) as paid_leave_days_total,
        coalesce(sum(day_fraction) filter (where not is_paid), 0) as unpaid_leave_days_total
    from employee_leave_rows
    group by leave_emp_uuid
)

select json_agg(
    json_build_object(
        'employeeUuid', a.employee_uuid,
        'companyEmployeeCode', a.company_employee_code,
        'fullName', a.full_name,
        'departmentName', a.department_name,
        'hoursWorkedTotal', a.hours_worked_total,
        'overtimeHoursTotal', a.overtime_hours_total,
        'totalWorkingDaysCount', a.total_working_days_count,
        'actualDaysWorkedCount', a.actual_days_worked_count,
        'daysAbsentCount', a.days_absent_count,
        'holidayDaysWorkedCount', a.holiday_days_worked_count,
        'holidayHoursWorkedTotal', coalesce(a.holiday_hours_worked_total, 0),
        'weekendDaysWorkedCount', a.weekend_days_worked_count,
        'weekendHoursWorkedTotal', coalesce(a.weekend_hours_worked_total, 0),
        'paidLeaveDaysTotal', coalesce(l.paid_leave_days_total, 0),
        'unpaidLeaveDaysTotal', coalesce(l.unpaid_leave_days_total, 0),
        'leaveAttendanceConflictCount', a.leave_attendance_conflict_count,
        'insufficientHalfDayHoursCount', a.insufficient_half_day_hours_count,
        'unacknowledgedAbsenceCount', a.unacknowledged_absence_count,
        'acknowledgedAbsenceCount', a.acknowledged_absence_count,
        'unacknowledgedInsufficientHalfDayCount', a.unacknowledged_insufficient_half_day_count,
        'pendingApprovalHoursTotal', coalesce(a.pending_approval_hours_total, 0),
        'leaveFractionErrorCount', a.leave_fraction_error_count,
        'estimatedNormalDayOtHoursTotal', coalesce(a.estimated_normal_day_ot_hours_total, 0),
        'estimatedRestDayHalfTierDaysCount', a.estimated_rest_day_half_tier_days_count,
        'estimatedRestDayFullTierDaysCount', a.estimated_rest_day_full_tier_days_count,
        'estimatedRestDayExcessHoursTotal', coalesce(a.estimated_rest_day_excess_hours_total, 0),
        'estimatedHolidayFullTierDaysCount', a.estimated_holiday_full_tier_days_count,
        'estimatedHolidayExcessHoursTotal', coalesce(a.estimated_holiday_excess_hours_total, 0),
        'resolvedEmail', coalesce(emp.email_work, emp.email_personal),
        'emailSource', case
            when emp.email_work is not null then 'work'
            when emp.email_personal is not null then 'personal'
            else null
        end
    )
    order by a.full_name
) into result
from attendance_summary a
left join leave_summary l on l.leave_emp_uuid = a.employee_uuid
left join public.employees emp on emp.id = a.employee_uuid;

return coalesce(result, '[]'::json);

end;
$$;

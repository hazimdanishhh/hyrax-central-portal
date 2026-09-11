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
-- leave_ledger_entries -- no new view/table columns needed. period_rows is
-- materialized for the same reason get_attendance_dashboard_rpc.sql
-- materializes it (unified_daily_attendance is expensive; this CTE is read
-- twice below).
--
-- HR/superadmin only -- no self-service branch (unlike
-- get_attendance_dashboard_rpc.sql), since this only ever powers the
-- HR-only Payroll Export tab (AccessRoute departments=["HR"]).
create or replace function get_payroll_period_summary(
    p_start_date    date,
    p_end_date      date,
    p_department_id bigint default null,
    p_employee_id   uuid default null
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
    and le.leave_date >= p_start_date
    and le.leave_date <= p_end_date
),

attendance_summary as (
    select
        employee_uuid,
        max(company_employee_code) as company_employee_code,
        max(full_name) as full_name,
        max(department_name) as department_name,
        round(sum(hours_worked)::numeric, 2) as hours_worked_total,
        round(sum(overtime_hours)::numeric, 2) as overtime_hours_total,
        -- Mirrors PAYROLL-DATA-REQUIREMENTS.md's own documented-correct
        -- "Days absent" definition -- hr_flag = 'Absent' alone overcounts
        -- unworked weekends/holidays, both of which also read 'Absent'.
        count(*) filter (where hr_flag = 'Absent' and not is_weekend and not is_public_holiday) as days_absent_count,
        count(*) filter (where is_worked_on_holiday) as holiday_days_worked_count,
        round(sum(holiday_hours_worked) filter (where is_worked_on_holiday)::numeric, 2) as holiday_hours_worked_total,
        count(*) filter (where is_worked_on_weekend) as weekend_days_worked_count,
        round(sum(weekend_hours_worked) filter (where is_worked_on_weekend)::numeric, 2) as weekend_hours_worked_total,
        count(*) filter (where is_leave_attendance_conflict) as leave_attendance_conflict_count,
        count(*) filter (where is_insufficient_half_day_hours) as insufficient_half_day_hours_count,
        count(*) filter (where has_leave_fraction_error) as leave_fraction_error_count
    from period_rows
    group by employee_uuid
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
        'daysAbsentCount', a.days_absent_count,
        'holidayDaysWorkedCount', a.holiday_days_worked_count,
        'holidayHoursWorkedTotal', coalesce(a.holiday_hours_worked_total, 0),
        'weekendDaysWorkedCount', a.weekend_days_worked_count,
        'weekendHoursWorkedTotal', coalesce(a.weekend_hours_worked_total, 0),
        'paidLeaveDaysTotal', coalesce(l.paid_leave_days_total, 0),
        'unpaidLeaveDaysTotal', coalesce(l.unpaid_leave_days_total, 0),
        'leaveAttendanceConflictCount', a.leave_attendance_conflict_count,
        'insufficientHalfDayHoursCount', a.insufficient_half_day_hours_count,
        'leaveFractionErrorCount', a.leave_fraction_error_count
    )
    order by a.full_name
) into result
from attendance_summary a
left join leave_summary l on l.leave_emp_uuid = a.employee_uuid;

return coalesce(result, '[]'::json);

end;
$$;

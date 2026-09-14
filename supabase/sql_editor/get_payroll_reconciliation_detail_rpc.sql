-- get_payroll_reconciliation_detail: backs PayrollReconciliationSidebar.jsx
-- (src/components/attendance/payrollReconciliationSidebar/) -- the
-- row-click drilldown on the Payroll Export tab. Re-derives
-- get_payroll_period_summary_rpc.sql's 4 reconciliation counts
-- (daysAbsentCount/leaveAttendanceConflictCount/
-- insufficientHalfDayHoursCount/leaveFractionErrorCount) down to the
-- actual flagged dates for ONE employee + ONE period, via the shared
-- get_payroll_reconciliation_rows() helper (supabase/functions/
-- get_payroll_reconciliation_rows.sql) so this RPC and
-- queue_payroll_reconciliation_email_rpc.sql can never disagree on which
-- days/categories qualify.
--
-- HR/superadmin only -- identical guard to get_payroll_period_summary_rpc.sql
-- (same sensitive per-employee attendance data, just scoped to one person
-- instead of aggregated across the department/company). Not itself
-- SECURITY DEFINER -- it runs as the calling HR/superadmin user, same
-- posture as get_payroll_period_summary; the underlying helper is the one
-- that needs SECURITY DEFINER, since it reads unified_daily_attendance
-- directly.
create or replace function get_payroll_reconciliation_detail(
    p_employee_uuid uuid,
    p_start_date    date,
    p_end_date      date
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_is_hr_or_superadmin boolean;
begin

select (public.is_superadmin() or p.department_id = 7)
into v_is_hr_or_superadmin
from public.profiles p
where p.id = auth.uid();

if not coalesce(v_is_hr_or_superadmin, false) then
    raise exception 'Unauthorized: get_payroll_reconciliation_detail requires HR/superadmin' using errcode = '42501';
end if;

if p_employee_uuid is null or p_start_date is null or p_end_date is null then
    raise exception 'get_payroll_reconciliation_detail requires p_employee_uuid, p_start_date, and p_end_date' using errcode = '22004';
end if;

select json_agg(
    json_build_object(
        'workDate', g.work_date,
        'category', g.category,
        'hrFlag', g.hr_flag,
        'leaveTypeCodes', g.leave_type_codes,
        'leaveDayFraction', g.leave_day_fraction,
        'hoursWorked', g.hours_worked,
        'isWeekend', g.is_weekend,
        'isPublicHoliday', g.is_public_holiday,
        'publicHolidayName', g.public_holiday_name
    )
    order by g.work_date, g.category
) into result
from public.get_payroll_reconciliation_rows(p_employee_uuid, p_start_date, p_end_date) g;

return coalesce(result, '[]'::json);

end;
$$;

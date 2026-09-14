-- arguments: p_employee_uuid uuid, p_start_date date, p_end_date date
-- returns: table (work_date, category, hr_flag, leave_type_codes,
--                  leave_day_fraction, hours_worked, is_weekend,
--                  is_public_holiday, public_holiday_name)
--
-- Shared day-level reconciliation detail behind BOTH
-- get_payroll_reconciliation_detail_rpc.sql (the sidebar's on-screen fetch)
-- and queue_payroll_reconciliation_email_rpc.sql (the emailed list) --
-- factored out once specifically so those two call sites can never
-- independently drift on which days/categories qualify, mirroring how
-- leave_ledger_content_key() is factored out of sync_leave_ledger_rpc.sql
-- for its own two call sites.
--
-- One row per (work_date, category) pair, NOT one row per day with 4
-- boolean columns -- a single day can legitimately match more than one
-- category (e.g. a half-day leave whose total daily fraction also exceeds
-- 1.0 is both insufficient_half_day AND leave_fraction_error at once), and
-- a flat (date, category) row lets both callers group with one
-- `where category = ...` filter each, with no risk of a caller forgetting
-- to check one of 4 independent booleans.
--
-- `category` values match payroll_reconciliation_glossary.code exactly:
-- 'absent' / 'leave_conflict' / 'insufficient_half_day' /
-- 'leave_fraction_error'. Mirrors get_payroll_period_summary_rpc.sql's own
-- daysAbsentCount/leaveAttendanceConflictCount/
-- insufficientHalfDayHoursCount/leaveFractionErrorCount predicates exactly,
-- so a payroll summary count and this drilldown's row count for the same
-- employee/period can never silently disagree.
--
-- SECURITY DEFINER + its own inline HR/superadmin guard, not just a
-- "trusts caller" comment -- this is a `public` schema function, which
-- Supabase/PostgREST exposes as a directly-callable RPC endpoint by
-- default, and this codebase never uses REVOKE EXECUTE anywhere (every
-- other RPC here instead relies on an inline auth.uid()/department check).
-- Without this guard, any authenticated user could call this function
-- directly with an arbitrary p_employee_uuid and read a coworker's
-- absence/leave-conflict history -- unified_daily_attendance has no
-- security_invoker, so RLS on the underlying tables would not catch this.
-- language plpgsql (never sql -- Postgres can inline a simple sql-language
-- function during planning, silently dropping SECURITY DEFINER) + set
-- search_path = '' + fully-qualified names: same hardening as every other
-- SECURITY DEFINER function in this schema.
create or replace function public.get_payroll_reconciliation_rows(
    p_employee_uuid uuid,
    p_start_date    date,
    p_end_date      date
)
returns table (
    work_date            date,
    category             text,
    hr_flag              text,
    leave_type_codes     text,
    leave_day_fraction   numeric,
    hours_worked         numeric,
    is_weekend           boolean,
    is_public_holiday    boolean,
    public_holiday_name  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_is_hr_or_superadmin boolean;
begin
    select (public.is_superadmin() or p.department_id = 7)
    into v_is_hr_or_superadmin
    from public.profiles p
    where p.id = auth.uid();

    if not coalesce(v_is_hr_or_superadmin, false) then
        raise exception 'Unauthorized: get_payroll_reconciliation_rows requires HR/superadmin' using errcode = '42501';
    end if;

    return query
    with period_rows as (
        select uda.*
        from public.unified_daily_attendance uda
        where uda.employee_uuid = p_employee_uuid
        and uda.work_date >= p_start_date
        and uda.work_date <= p_end_date
    )
    select r.work_date, 'absent'::text, r.hr_flag, r.leave_type_codes,
           r.leave_day_fraction, r.hours_worked, r.is_weekend,
           r.is_public_holiday, r.public_holiday_name
    from period_rows r
    where r.hr_flag = 'Absent' and not r.is_weekend and not r.is_public_holiday

    union all

    select r.work_date, 'leave_conflict', r.hr_flag, r.leave_type_codes,
           r.leave_day_fraction, r.hours_worked, r.is_weekend,
           r.is_public_holiday, r.public_holiday_name
    from period_rows r
    where r.is_leave_attendance_conflict

    union all

    select r.work_date, 'insufficient_half_day', r.hr_flag, r.leave_type_codes,
           r.leave_day_fraction, r.hours_worked, r.is_weekend,
           r.is_public_holiday, r.public_holiday_name
    from period_rows r
    where r.is_insufficient_half_day_hours

    union all

    select r.work_date, 'leave_fraction_error', r.hr_flag, r.leave_type_codes,
           r.leave_day_fraction, r.hours_worked, r.is_weekend,
           r.is_public_holiday, r.public_holiday_name
    from period_rows r
    where r.has_leave_fraction_error

    order by 1, 2;
end;
$$;

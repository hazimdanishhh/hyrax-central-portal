// features/employee/attendance/private/api/myAttendanceService.js

import { supabase } from "@/lib/supabaseClient";
import {
  fetchUnifiedAttendance,
  fetchUnifiedAttendanceSearch,
} from "@/features/hr/attendance/private/api/attendanceOverviewService";
import { buildAttendanceDashboardParams } from "@/features/hr/attendance/private/api/fetchAttendanceDashboard";
import { formatTime } from "@/functions/formatDate";

// Curried wrappers around HR's fetchers -- they already handle an "employee"
// filter key generically, so this reuses them unmodified instead of forking
// attendanceOverviewService.js's private applyAttendanceFilter logic. The
// fixed employee id is applied AFTER spreading whatever filters the URL/UI
// produced, so it always wins even if a stray/hand-edited URL param sets the
// same key -- a client-side convenience safeguard only, not the real
// security boundary (that's server-side RLS on attendance_activities/the
// underlying views).
export const fetchMyAttendance = (employeeId) => (params) =>
  fetchUnifiedAttendance({
    ...params,
    filters: { ...params.filters, employee: employeeId },
  });

export const fetchMyAttendanceSearch = (employeeId) => (params) =>
  fetchUnifiedAttendanceSearch({
    ...params,
    filters: { ...params.filters, employee: employeeId },
  });

// My Attendance Overview -- reuses get_attendance_dashboard unchanged
// (p_employee_id already scopes every CTE), just fixes the employee param
// instead of taking it from a picker.
export const fetchMyAttendanceDashboard = (employeeId) => async ({ filters }) => {
  const { data, error } = await supabase.rpc("get_attendance_dashboard", {
    ...buildAttendanceDashboardParams(filters),
    p_employee_id: employeeId,
  });

  if (error) throw error;

  return data;
};

// My Attendance This Week -- backs the Dashboard "Today's Attendance" card
// and ClockinMini's hybrid status fallback. A single narrow query directly
// against unified_daily_attendance (not fetchUnifiedAttendance's day-mode or
// fetchUnifiedAttendanceSearch's paginated all-time shape above -- this needs
// one bounded range with no pagination/search UI). "Today" and "this week"
// both come from this one result set; the caller (useMyAttendanceThisWeek)
// owns the date math so both consumers share one query key.
export const fetchMyAttendanceThisWeek =
  (employeeId) =>
  async ({ weekStartISO, todayISO }) => {
    const { data, error } = await supabase
      .from("unified_daily_attendance")
      .select(
        "employee_uuid, work_date, hr_flag, first_in, last_out, hours_worked, overtime_hours, daily_activities, is_on_leave, leave_type_codes",
      )
      .eq("employee_uuid", employeeId)
      .gte("work_date", weekStartISO)
      .lte("work_date", todayISO)
      .order("work_date", { ascending: true });

    if (error) throw error;

    // hours_worked stays numeric here (unlike attendanceOverviewService.js's
    // normalizeUnifiedAttendance, which formats it to a fixed-2 string) since
    // useMyAttendanceThisWeek sums it for the weekly total/chart.
    return (data || []).map((row) => ({
      ...row,
      first_in_time: formatTime(row.first_in),
      last_out_time: formatTime(row.last_out),
    }));
  };

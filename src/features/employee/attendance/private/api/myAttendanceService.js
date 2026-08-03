// features/employee/attendance/private/api/myAttendanceService.js

import { supabase } from "@/lib/supabaseClient";
import {
  fetchUnifiedAttendance,
  fetchUnifiedAttendanceSearch,
} from "@/features/hr/attendance/private/api/attendanceOverviewService";
import { buildAttendanceDashboardParams } from "@/features/hr/attendance/private/api/fetchAttendanceDashboard";

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

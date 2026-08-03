// features/employee/attendance/private/api/teamAttendanceService.js

import { supabase } from "@/lib/supabaseClient";
import {
  fetchUnifiedAttendance,
  fetchUnifiedAttendanceSearch,
} from "@/features/hr/attendance/private/api/attendanceOverviewService";
import { buildAttendanceDashboardParams } from "@/features/hr/attendance/private/api/fetchAttendanceDashboard";

// Same reuse strategy as myAttendanceService.js, fixed to "manager" instead
// of "employee" -- unified_daily_attendance already carries manager_id
// directly, and HR's own "manager" filter dropdown already proves this key
// works generically.
export const fetchTeamAttendance = (managerId) => (params) =>
  fetchUnifiedAttendance({
    ...params,
    filters: { ...params.filters, manager: managerId },
  });

export const fetchTeamAttendanceSearch = (managerId) => (params) =>
  fetchUnifiedAttendanceSearch({
    ...params,
    filters: { ...params.filters, manager: managerId },
  });

// Team Attendance Overview -- needs the new p_manager_id param added to
// get_attendance_dashboard (threaded through every CTE, mirroring
// p_employee_id's shape exactly).
export const fetchTeamAttendanceDashboard = (managerId) => async ({ filters }) => {
  const { data, error } = await supabase.rpc("get_attendance_dashboard", {
    ...buildAttendanceDashboardParams(filters),
    p_manager_id: managerId,
  });

  if (error) throw error;

  return data;
};

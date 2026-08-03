// features/hr/attendance/private/api/fetchAttendanceDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Attendance Overview dashboard data
 * Source: get_attendance_dashboard()
 */
// Shared filters -> RPC-param mapping, reused by the My/Team Attendance
// Overview fetchers (features/employee/attendance/private/api/) so the
// startDate/endDate/department/employee switch isn't duplicated per caller.
export function buildAttendanceDashboardParams(filters) {
  const rpcParams = {
    p_start_date: null,
    p_end_date: null,
    p_department_id: null,
    p_employee_id: null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "startDate":
        rpcParams.p_start_date = value;
        break;

      case "endDate":
        rpcParams.p_end_date = value;
        break;

      case "department":
        rpcParams.p_department_id = value;
        break;

      case "employee":
        rpcParams.p_employee_id = value;
        break;

      default:
        break;
    }
  });

  return rpcParams;
}

export async function fetchAttendanceDashboard({ filters }) {
  const rpcParams = buildAttendanceDashboardParams(filters);

  const { data, error } = await supabase.rpc(
    "get_attendance_dashboard",
    rpcParams,
  );

  if (error) throw error;

  return data;
}

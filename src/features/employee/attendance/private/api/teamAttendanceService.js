// features/employee/attendance/private/api/teamAttendanceService.js

import {
  fetchUnifiedAttendance,
  fetchUnifiedAttendanceSearch,
} from "@/features/hr/attendance/private/api/attendanceOverviewService";

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

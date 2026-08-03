// features/employee/attendance/private/api/myAttendanceService.js

import {
  fetchUnifiedAttendance,
  fetchUnifiedAttendanceSearch,
} from "@/features/hr/attendance/private/api/attendanceOverviewService";

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

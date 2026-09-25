import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceDashboard } from "../api/fetchAttendanceDashboard";

// KPI strip for the HR Attendance Management list page -- reuses
// get_attendance_dashboard unchanged (the same RPC the Overview page calls),
// scoped to `filters` exactly as the list's own SearchFilterBar/day-navigator
// currently has it (see AttendanceManagement.jsx's own wiring for how the
// Day-mode date gets folded into this as startDate/endDate). A separate
// query key from Attendance Overview's own "attendance_dashboard" -- the two
// pages' filters are independent, so their cached results must be too.
export default function useAttendanceListOverview(filters) {
  return useQuery({
    queryKey: ["attendance_list_overview", filters],
    queryFn: () => fetchAttendanceDashboard({ filters }),
  });
}

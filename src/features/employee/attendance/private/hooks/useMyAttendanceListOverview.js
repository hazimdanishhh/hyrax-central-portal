import { useQuery } from "@tanstack/react-query";
import { fetchMyAttendanceDashboard } from "../api/myAttendanceService";

// KPI strip for the My Attendance list page -- same reuse strategy as
// fetchMyAttendanceDashboard itself (My Attendance Overview): pins
// p_employee_id, letting every other scope come from whatever the list's
// own filters currently are.
export default function useMyAttendanceListOverview(employeeId, filters) {
  return useQuery({
    queryKey: ["my_attendance_list_overview", employeeId, filters],
    queryFn: () => fetchMyAttendanceDashboard(employeeId)({ filters }),
    enabled: !!employeeId,
  });
}

import { useQuery } from "@tanstack/react-query";
import { fetchTeamAttendanceDashboard } from "../api/teamAttendanceService";

// KPI strip for the Team Attendance list page -- same reuse strategy as
// fetchTeamAttendanceDashboard itself (Team Attendance Overview): pins
// p_manager_id, letting every other scope come from whatever the list's
// own filters currently are.
export default function useTeamAttendanceListOverview(managerId, filters) {
  return useQuery({
    queryKey: ["team_attendance_list_overview", managerId, filters],
    queryFn: () => fetchTeamAttendanceDashboard(managerId)({ filters }),
    enabled: !!managerId,
  });
}

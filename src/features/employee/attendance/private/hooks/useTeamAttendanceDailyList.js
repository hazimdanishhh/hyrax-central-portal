// features/employee/attendance/private/hooks/useTeamAttendanceDailyList.js

import useAttendanceDailyList from "@/features/hr/attendance/private/hooks/useAttendanceDailyList";
import { fetchTeamAttendance } from "../api/teamAttendanceService";

export default function useTeamAttendanceDailyList({
  managerId,
  queryKey = "team_attendance_daily",
  defaultSortBy = "full_name",
  defaultSortOrder = "ascending",
  enabled = true,
}) {
  return useAttendanceDailyList({
    queryKey,
    queryFn: fetchTeamAttendance(managerId),
    defaultSortBy,
    defaultSortOrder,
    enabled: Boolean(managerId) && enabled,
  });
}

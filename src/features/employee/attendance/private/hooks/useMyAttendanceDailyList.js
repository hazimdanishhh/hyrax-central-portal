// features/employee/attendance/private/hooks/useMyAttendanceDailyList.js

import useAttendanceDailyList from "@/features/hr/attendance/private/hooks/useAttendanceDailyList";
import { fetchMyAttendance } from "../api/myAttendanceService";

export default function useMyAttendanceDailyList({
  employeeId,
  queryKey = "my_attendance_daily",
  defaultSortBy = "full_name",
  defaultSortOrder = "ascending",
  enabled = true,
}) {
  return useAttendanceDailyList({
    queryKey,
    queryFn: fetchMyAttendance(employeeId),
    defaultSortBy,
    defaultSortOrder,
    enabled: Boolean(employeeId) && enabled,
  });
}

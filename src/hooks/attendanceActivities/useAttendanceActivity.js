// hooks/useAttendanceActivity.js

import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceActivity } from "../../services/attendanceActivitiesServices/attendanceActivityService";

export default function useAttendanceActivity(attendanceId) {
  return useQuery({
    queryKey: ["attendanceActivity", attendanceId],
    queryFn: () => fetchAttendanceActivity(attendanceId),
    enabled: !!attendanceId,
    staleTime: 1000 * 60,
  });
}

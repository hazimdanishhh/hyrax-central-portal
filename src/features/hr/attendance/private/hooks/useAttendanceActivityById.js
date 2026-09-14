import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceActivityById } from "../api/attendanceOverviewService";

export function useAttendanceActivityById(attendanceId) {
  return useQuery({
    queryKey: ["attendanceActivity", attendanceId],
    queryFn: () => fetchAttendanceActivityById(attendanceId),
    enabled: !!attendanceId && attendanceId !== "new",
    staleTime: 1000 * 60 * 5,
  });
}

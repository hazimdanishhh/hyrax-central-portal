import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceAdjustmentReasons } from "../api/attendanceAdjustmentReasonsService";

/**
 * Lookup data that changes about once a year -- long staleTime, same treatment
 * useAttendanceActivitiesMetadata gives departments/attendance types.
 */
export default function useAttendanceAdjustmentReasons() {
  const query = useQuery({
    queryKey: ["attendanceAdjustmentReasons"],
    queryFn: fetchAttendanceAdjustmentReasons,
    staleTime: 1000 * 60 * 30,
  });

  return {
    ...query,
    adjustmentReasons: query.data || [],
  };
}

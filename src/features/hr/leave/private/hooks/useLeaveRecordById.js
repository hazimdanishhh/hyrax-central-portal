import { useQuery } from "@tanstack/react-query";
import { fetchLeaveRecordById } from "../api/leaveRecordsService";

export function useLeaveRecordById(leaveId) {
  return useQuery({
    queryKey: ["leaveRecord", leaveId],
    queryFn: () => fetchLeaveRecordById(leaveId),
    enabled: !!leaveId,
    staleTime: 1000 * 60 * 5,
  });
}

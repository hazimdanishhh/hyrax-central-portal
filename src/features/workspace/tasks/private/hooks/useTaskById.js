import { useQuery } from "@tanstack/react-query";
import { fetchTaskById } from "../api/taskByIdService";

export function useTaskById(taskId) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => fetchTaskById(taskId),
    enabled: !!taskId,
    staleTime: 1000 * 60 * 5,
  });
}

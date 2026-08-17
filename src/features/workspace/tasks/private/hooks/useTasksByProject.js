import { useQuery } from "@tanstack/react-query";
import { fetchTasksByProject } from "../api/tasksByProjectService";

export function useTasksByProject(projectId) {
  const query = useQuery({
    queryKey: ["tasksByProject", projectId],
    queryFn: () => fetchTasksByProject(projectId),
    enabled: !!projectId,
  });

  return {
    ...query,
    tasks: query.data ?? [],
  };
}

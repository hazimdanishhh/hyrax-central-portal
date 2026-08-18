import { useQuery } from "@tanstack/react-query";
import { fetchRecentTasks } from "../api/myTasksService";
import { useEmployee } from "../../../../../context/EmployeeContext";

/**
 * Backs the home dashboard's Recent Tasks widget -- same "gate on a
 * resolved employeeId" convention as useMyTasks.
 */
export function useRecentTasks(limit = 5) {
  const { employee } = useEmployee();
  const employeeId = employee?.id;

  const query = useQuery({
    queryKey: ["tasks", "recent", employeeId, limit],
    queryFn: () => fetchRecentTasks(employeeId, limit),
    enabled: !!employeeId,
    staleTime: 1000 * 60,
  });

  return { ...query, tasks: query.data || [] };
}

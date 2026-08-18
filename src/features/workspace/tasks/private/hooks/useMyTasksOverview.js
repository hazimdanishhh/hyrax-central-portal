import { useQuery } from "@tanstack/react-query";
import { fetchMyTasksOverview } from "../api/myTasksService";
import { useEmployee } from "../../../../../context/EmployeeContext";

const EMPTY_KPIS = { totalCount: 0, overdueCount: 0, dueSoonCount: 0, completedCount: 0 };

/**
 * Backs the My Tasks list page's OverviewCards. `enabled` only gates
 * readiness (has the employee context resolved yet) -- the RPC itself
 * takes no employeeId parameter, current_employee_id() resolves it
 * server-side.
 */
export function useMyTasksOverview() {
  const { employee } = useEmployee();

  const query = useQuery({
    queryKey: ["tasks", "overview"],
    queryFn: fetchMyTasksOverview,
    enabled: !!employee?.id,
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}

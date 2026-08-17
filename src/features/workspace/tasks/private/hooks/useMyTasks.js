import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { fetchMyTasks } from "../api/myTasksService";
import { useEmployee } from "../../../../../context/EmployeeContext";

/**
 * Cross-project "what do I need to do" view, backing the pre-existing
 * workspace/tasks stub route. `enabled` gates the query until the
 * employee record has resolved -- fetchMyTasks needs a real employeeId,
 * not a still-loading undefined one.
 */
export function useMyTasks() {
  const { employee } = useEmployee();

  return usePaginatedQuery({
    queryKey: "myTasks",
    queryFn: fetchMyTasks, // extraParams below already supplies employeeId in the shape fetchMyTasks expects
    pageSize: 20,
    defaultSortBy: "due_date",
    extraParams: { employeeId: employee?.id },
    enabled: !!employee?.id,
  });
}

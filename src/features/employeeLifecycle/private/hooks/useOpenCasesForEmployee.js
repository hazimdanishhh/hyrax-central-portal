import { useQuery } from "@tanstack/react-query";
import { fetchOpenCasesForEmployee } from "../api/employeeOpenCasesService";

/**
 * Backs EmployeeLifecycleCaseSummary (the HR Employee Management sidebar
 * integration) and the table/card badge columns -- one query per opened
 * employee row, not per page load.
 */
export function useOpenCasesForEmployee(employeeId) {
  const query = useQuery({
    queryKey: ["employeeOpenLifecycleCases", employeeId],
    queryFn: () => fetchOpenCasesForEmployee(employeeId),
    enabled: !!employeeId,
  });

  return { ...query, cases: query.data || [] };
}

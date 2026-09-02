import { useQuery } from "@tanstack/react-query";
import { useEmployee } from "../../../../context/EmployeeContext";
import { fetchMyLifecycleCase } from "../api/fetchMyLifecycleCase";

// employeeId comes from EmployeeContext, not auth/profile directly -- see
// fetchMyLifecycleCase.js's header for why an explicit employee_id filter
// is required (RLS alone isn't enough for a caller who is also HR/IT).
// `enabled` gates the query until EmployeeContext has actually resolved,
// so this never fires with employeeId undefined; `isLoading` folds in
// EmployeeContext's own loading state too, so there's no flash of "no
// case" while EmployeeContext is still resolving on first mount.
export function useMyLifecycleCase(caseType) {
  const { employee, loading: employeeLoading } = useEmployee();
  const employeeId = employee?.id;

  const query = useQuery({
    queryKey: ["myLifecycleCase", caseType, employeeId],
    queryFn: () => fetchMyLifecycleCase(caseType, employeeId),
    enabled: !!employeeId,
  });

  return {
    ...query,
    lifecycleCase: query.data || null,
    isLoading: employeeLoading || query.isLoading,
  };
}

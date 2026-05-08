import { useQuery } from "@tanstack/react-query";
import { getDepartmentEmployeesPublicById } from "../api/byDepartment";

/**
 * Hook to fetch the current logged-in user's department employees
 */
export default function useDepartmentEmployeesPublic(departmentId) {
  return useQuery({
    queryKey: ["employee_public", departmentId],
    queryFn: () => getDepartmentEmployeesPublicById(departmentId),
    enabled: !!departmentId,
    staleTime: 1000 * 60 * 5,
  });
}

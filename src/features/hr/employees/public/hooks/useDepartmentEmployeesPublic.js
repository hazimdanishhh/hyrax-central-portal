import { useQuery } from "@tanstack/react-query";
import { fetchDepartmentEmployeesPublicById } from "../api/departmentEmployeesPublic";

/**
 * Hook to fetch the department employees by department ID
 */
export default function useDepartmentEmployeesPublic(departmentId) {
  return useQuery({
    queryKey: ["department_employees_public", departmentId],
    queryFn: () => fetchDepartmentEmployeesPublicById(departmentId),
    enabled: !!departmentId,
    staleTime: 1000 * 60 * 5,
  });
}

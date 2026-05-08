import { useQuery } from "@tanstack/react-query";
import { fetchEmployeePublicById } from "../api/employeePublic";

/**
 * Hook to fetch employee by employee ID
 */
export default function useEmployeePublic(employeeId) {
  return useQuery({
    queryKey: ["employee_public", employeeId],
    queryFn: () => fetchEmployeePublicById(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5,
  });
}

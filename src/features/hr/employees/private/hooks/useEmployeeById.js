import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeById } from "../api/fetchEmployeeById";

export function useEmployeeById(employeeId) {
  return useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => fetchEmployeeById(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5,
  });
}

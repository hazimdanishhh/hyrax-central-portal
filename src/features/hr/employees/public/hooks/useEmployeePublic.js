import { useQuery } from "@tanstack/react-query";
import { getEmployeePublicById } from "../api/byId";

export default function useEmployeePublic(employeeId) {
  return useQuery({
    queryKey: ["employee_public", employeeId],
    queryFn: () => getEmployeePublicById(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5,
  });
}

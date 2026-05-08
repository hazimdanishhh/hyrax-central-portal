import { useQuery } from "@tanstack/react-query";
import { fetchEmployeesPublicMetadata } from "../api/employeesPublicMetadata";

/**
 * Hook to fetch employee metadata for filter and table config
 */
export function useEmployeesPublicMetadata() {
  const query = useQuery({
    queryKey: ["employeesMetadata"],
    queryFn: fetchEmployeesPublicMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    managers: query.data?.managers || [],
    departments: query.data?.departments || [],
    nationalities: query.data?.nationalities || [],
    employmentTypes: query.data?.employmentTypes || [],
  };
}

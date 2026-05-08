import { useQuery } from "@tanstack/react-query";
import { fetchEmployeesMetadata } from "../api/employeesMetadataService";

export function useEmployeesMetadata() {
  const query = useQuery({
    queryKey: ["employeesMetadata"],
    queryFn: fetchEmployeesMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    managers: query.data?.managers || [],
    profiles: query.data?.profiles || [],
    departments: query.data?.departments || [],
    nationalities: query.data?.nationalities || [],
    identificationTypes: query.data?.identificationTypes || [],
    employmentTypes: query.data?.employmentTypes || [],
    terminationReasons: query.data?.terminationReasons || [],
    employmentStatuses: query.data?.employmentStatuses || [],
  };
}

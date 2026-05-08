import { useQuery } from "@tanstack/react-query";
import { fetchProfilesMetadata } from "../api/profilesMetadata";

export function useProfilesMetadata() {
  const query = useQuery({
    queryKey: ["profilesMetadata"],
    queryFn: fetchProfilesMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    roles: query.data?.roles || [],
    departments: query.data?.departments || [],
  };
}

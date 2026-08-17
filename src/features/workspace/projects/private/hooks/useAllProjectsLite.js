import { useQuery } from "@tanstack/react-query";
import { fetchAllProjectsLite } from "../api/projectsService";

export function useAllProjectsLite() {
  const query = useQuery({
    queryKey: ["allProjectsLite"],
    queryFn: fetchAllProjectsLite,
    staleTime: 1000 * 60 * 5,
  });

  return {
    ...query,
    projects: query.data || [],
  };
}

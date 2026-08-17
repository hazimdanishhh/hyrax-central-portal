import { useQuery } from "@tanstack/react-query";
import { fetchProjectDocuments } from "../api/projectDocumentsService";

export function useProjectDocuments(projectId) {
  const query = useQuery({
    queryKey: ["projectDocuments", projectId],
    queryFn: () => fetchProjectDocuments(projectId),
    enabled: !!projectId,
  });

  return {
    ...query,
    documents: query.data ?? [],
  };
}

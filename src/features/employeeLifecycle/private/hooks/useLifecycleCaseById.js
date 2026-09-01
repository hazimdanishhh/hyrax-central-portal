import { useQuery } from "@tanstack/react-query";
import { fetchLifecycleCaseById } from "../api/fetchLifecycleCaseById";

export function useLifecycleCaseById(caseId) {
  const query = useQuery({
    queryKey: ["lifecycleCase", caseId],
    queryFn: () => fetchLifecycleCaseById(caseId),
    enabled: !!caseId,
  });

  return { ...query, lifecycleCase: query.data || null };
}

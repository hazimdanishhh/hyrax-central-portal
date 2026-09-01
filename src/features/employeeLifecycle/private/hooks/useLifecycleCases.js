import { useQuery } from "@tanstack/react-query";
import { fetchLifecycleCases } from "../api/lifecycleCasesService";

/**
 * Backs both LifecycleCaseList (the card grid) and useLifecycleCasesOverview
 * (KPI tiles computed from the same result, no second round trip) --
 * one query per case_type, shared via React Query's own cache key dedup.
 */
export function useLifecycleCases(caseType) {
  const query = useQuery({
    queryKey: ["lifecycleCases", caseType],
    queryFn: () => fetchLifecycleCases(caseType),
    enabled: !!caseType,
  });

  return { ...query, cases: query.data || [] };
}

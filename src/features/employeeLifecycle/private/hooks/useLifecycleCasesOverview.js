import { useMemo } from "react";
import { useLifecycleCases } from "./useLifecycleCases";
import { computeCasesOverview } from "../lifecycleCaseHelpers";

const EMPTY_KPIS = { openCount: 0, completedThisMonthCount: 0, stuckCount: 0 };

export function useLifecycleCasesOverview(caseType) {
  const { cases, isLoading, error } = useLifecycleCases(caseType);

  const kpis = useMemo(() => (cases.length ? computeCasesOverview(cases) : EMPTY_KPIS), [cases]);

  return { kpis, isLoading, error };
}

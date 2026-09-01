import { useQuery } from "@tanstack/react-query";
import { fetchMyLifecycleCase } from "../api/fetchMyLifecycleCase";

export function useMyLifecycleCase(caseType) {
  const query = useQuery({
    queryKey: ["myLifecycleCase", caseType],
    queryFn: () => fetchMyLifecycleCase(caseType),
  });

  return { ...query, lifecycleCase: query.data || null };
}

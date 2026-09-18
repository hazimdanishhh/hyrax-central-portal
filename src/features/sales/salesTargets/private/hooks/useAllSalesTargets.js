import { useQuery } from "@tanstack/react-query";
import { fetchAllSalesTargets } from "../api/salesTargetsService";

// Nested under the "sales_targets" key on purpose -- useSalesTargetsMutations's
// existing invalidateQueries({ queryKey: ["sales_targets"] }) fuzzy-matches
// any key with this prefix, so this query is invalidated for free after a
// create/update/delete with zero changes to the mutations hook.
export function useAllSalesTargets() {
  const query = useQuery({
    queryKey: ["sales_targets", "all"],
    queryFn: fetchAllSalesTargets,
  });

  return { ...query, targets: query.data ?? [] };
}

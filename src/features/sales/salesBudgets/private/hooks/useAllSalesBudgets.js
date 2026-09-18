import { useQuery } from "@tanstack/react-query";
import { fetchAllSalesBudgets } from "../api/salesBudgetsService";

// Nested under the "sales_budgets" key on purpose -- useSalesBudgetsMutations's
// existing invalidateQueries({ queryKey: ["sales_budgets"] }) fuzzy-matches
// any key with this prefix, so this query is invalidated for free after a
// create/update/delete with zero changes to the mutations hook.
export function useAllSalesBudgets() {
  const query = useQuery({
    queryKey: ["sales_budgets", "all"],
    queryFn: fetchAllSalesBudgets,
  });

  return { ...query, budgets: query.data ?? [] };
}

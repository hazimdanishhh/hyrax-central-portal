import { useQuery } from "@tanstack/react-query";
import { fetchSalesBudgetById } from "../api/salesBudgetsService";

export function useSalesBudgetById(budgetId) {
  return useQuery({
    queryKey: ["salesBudget", budgetId],
    queryFn: () => fetchSalesBudgetById(budgetId),
    enabled: !!budgetId && budgetId !== "new",
    staleTime: 1000 * 60 * 5,
  });
}

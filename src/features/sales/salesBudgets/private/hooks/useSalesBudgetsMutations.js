import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSalesBudget,
  updateSalesBudget,
  deleteSalesBudget,
} from "../api/salesBudgetsMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "sales budget",
  constraints: {
    sales_budgets_rep_month_unique:
      "A budget already exists for this rep and month -- edit that row instead.",
  },
};

export default function useSalesBudgetsMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const createMutation = useMutation({
    mutationFn: createSalesBudget,
    onMutate: () => showMessage("Saving budget...", "loading"),
    onSuccess: () => {
      showMessage("Budget saved", "success");
      queryClient.invalidateQueries({ queryKey: ["sales_budgets"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: updateSalesBudget,
    onMutate: () => showMessage("Updating budget...", "loading"),
    onSuccess: () => {
      showMessage("Budget updated", "success");
      queryClient.invalidateQueries({ queryKey: ["sales_budgets"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSalesBudget,
    onMutate: () => showMessage("Deleting budget...", "loading"),
    onSuccess: () => {
      showMessage("Budget deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["sales_budgets"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    createSalesBudget: createMutation.mutateAsync,
    updateSalesBudget: updateMutation.mutateAsync,
    deleteSalesBudget: deleteMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}

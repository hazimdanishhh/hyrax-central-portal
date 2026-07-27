import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
} from "../api/salesTargetsMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "sales target",
  constraints: {
    sales_targets_owner_month_unique:
      "A target already exists for this rep and month -- edit that row instead.",
  },
};

export default function useSalesTargetsMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const createMutation = useMutation({
    mutationFn: createSalesTarget,
    onMutate: () => showMessage("Saving target...", "loading"),
    onSuccess: () => {
      showMessage("Target saved", "success");
      queryClient.invalidateQueries({ queryKey: ["sales_targets"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: updateSalesTarget,
    onMutate: () => showMessage("Updating target...", "loading"),
    onSuccess: () => {
      showMessage("Target updated", "success");
      queryClient.invalidateQueries({ queryKey: ["sales_targets"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSalesTarget,
    onMutate: () => showMessage("Deleting target...", "loading"),
    onSuccess: () => {
      showMessage("Target deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["sales_targets"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    createSalesTarget: createMutation.mutateAsync,
    updateSalesTarget: updateMutation.mutateAsync,
    deleteSalesTarget: deleteMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}

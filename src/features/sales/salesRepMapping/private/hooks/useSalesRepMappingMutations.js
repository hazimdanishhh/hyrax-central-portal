import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSalesRepMapping } from "../api/salesRepMappingMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "sales rep mapping" };

export default function useSalesRepMappingMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const updateMutation = useMutation({
    mutationFn: updateSalesRepMapping,

    onMutate: () => {
      showMessage("Updating sales rep mapping...", "loading");
    },

    onSuccess: () => {
      showMessage("Sales rep mapping updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["sales_rep_mappings"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    updateSalesRepMapping: updateMutation.mutateAsync,
    updating: updateMutation.isPending,
  };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queuePayrollReconciliationEmail } from "../api/payrollReconciliationEmailMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "reconciliation email",
};

export default function usePayrollReconciliationEmailMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const queueMutation = useMutation({
    mutationFn: queuePayrollReconciliationEmail,

    onMutate: () => {
      showMessage("Queuing reconciliation email...", "loading");
    },

    onSuccess: (_data, variables) => {
      showMessage("Queued — will be sent within a few minutes", "success");

      queryClient.invalidateQueries({
        queryKey: [
          "payrollReconciliationLastSend",
          variables.employeeUuid,
          variables.startDate,
          variables.endDate,
        ],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    queuePayrollReconciliationEmail: queueMutation.mutateAsync,
    queuing: queueMutation.isPending,
  };
}

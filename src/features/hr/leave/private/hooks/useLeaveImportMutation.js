import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncLeaveLedger } from "../api/leaveImportService";
import { useMessage } from "@/context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "leave record" };

export default function useLeaveImportMutation() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const mutation = useMutation({
    mutationFn: syncLeaveLedger,

    onSuccess: (data) => {
      // Only a genuinely committed sync is worth a toast + refetch -- a dry
      // run preview or a guardrail block hasn't changed anything yet, and
      // CsvImportModal's own step screens already show HR exactly what
      // happened in both of those cases.
      if (data?.status === "applied") {
        showMessage("Leave data synced", "success");
        queryClient.invalidateQueries({ queryKey: ["leave_records"] });
      }
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    runImport: mutation.mutateAsync,
    importing: mutation.isPending,
  };
}

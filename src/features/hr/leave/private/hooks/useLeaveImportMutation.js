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

        // The sync auto-creates leave type codes it has not seen, so a
        // committed run can change the type vocabulary too -- without this,
        // the Leave Types tab and the type filter on this very page both show
        // a cached list that is missing exactly the types HR now has to go
        // and classify.
        queryClient.invalidateQueries({ queryKey: ["leave_ledger_types_all"] });
        queryClient.invalidateQueries({ queryKey: ["leave_ledger_types"] });
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

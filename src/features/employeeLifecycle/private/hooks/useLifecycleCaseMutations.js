import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLifecycleCase, updateChecklistItemStatus } from "../api/lifecycleCaseMutations";
import { deactivateProfile } from "../api/deactivateProfile";
import { useMessage } from "../../../../context/MessageContext";
import { getFriendlyError } from "../../../_shared/getFriendlyError";

const errorConfig = { entity: "lifecycle case" };

/**
 * Backs LifecycleCaseDetail -- case metadata edits (expected_last_day,
 * employee_can_view, the manual status override) and per-item status
 * changes both invalidate the same case query plus the list query (so a
 * completed case immediately moves status tab without a manual refresh)
 * and the Employee Management sidebar's open-cases query for this
 * employee (so EmployeeLifecycleCaseSummary/the table badge stay in sync
 * too).
 */
export function useLifecycleCaseMutations(caseId, employeeId, caseType) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lifecycleCase", caseId] });
    queryClient.invalidateQueries({ queryKey: ["lifecycleCases", caseType] });
    queryClient.invalidateQueries({ queryKey: ["employeeOpenLifecycleCases", employeeId] });
  };

  const updateCaseMutation = useMutation({
    mutationFn: updateLifecycleCase,
    onMutate: () => showMessage("Updating case...", "loading"),
    onSuccess: () => {
      showMessage("Case updated", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateItemMutation = useMutation({
    mutationFn: updateChecklistItemStatus,
    onMutate: () => showMessage("Updating checklist item...", "loading"),
    onSuccess: () => {
      showMessage("Checklist item updated", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const deactivateProfileMutation = useMutation({
    mutationFn: deactivateProfile,
    onMutate: () => showMessage("Deactivating portal account...", "loading"),
    onSuccess: () => {
      showMessage("Portal account deactivated", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    updateLifecycleCase: updateCaseMutation.mutateAsync,
    updateChecklistItemStatus: updateItemMutation.mutateAsync,
    deactivateProfile: deactivateProfileMutation.mutateAsync,

    updatingCase: updateCaseMutation.isPending,
    updatingItem: updateItemMutation.isPending,
    deactivatingProfile: deactivateProfileMutation.isPending,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllLeaveTypes,
  createLeaveType,
  updateLeaveType,
} from "../api/leaveTypesService";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "leave type",
  constraints: {
    leave_ledger_types_code_key:
      "A leave type with this code already exists. Codes must be unique -- the sync matches on them.",
  },
};

export function useLeaveTypes() {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["leave_ledger_types_all"],
    queryFn: fetchAllLeaveTypes,
  });

  return { leaveTypes: data || [], isLoading, isFetching, error };
}

export default function useLeaveTypeMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  // Three keys, not one. "leave_ledger_types_all" backs this tab;
  // "leave_ledger_types" backs the active-only picker elsewhere; and the
  // payroll summary reads is_paid to split paidLeaveDaysTotal from
  // unpaidLeaveDaysTotal -- so reclassifying a type moves numbers on Payroll
  // Export, and leaving that cached would show HR a figure they just changed.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["leave_ledger_types_all"] });
    queryClient.invalidateQueries({ queryKey: ["leave_ledger_types"] });
    queryClient.invalidateQueries({ queryKey: ["payroll_period_summary"] });
  };

  const createMutation = useMutation({
    mutationFn: createLeaveType,
    onMutate: () => showMessage("Creating leave type...", "loading"),
    onSuccess: () => {
      showMessage("Leave type created", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: updateLeaveType,
    onMutate: () => showMessage("Updating leave type...", "loading"),
    onSuccess: () => {
      showMessage("Leave type updated", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  // No delete. leave_ledger_entries.leave_type_id references this table, so
  // deleting a type in use fails on the foreign key -- and deleting an unused
  // one is still wrong, because the next sync would recreate it from the
  // source file. Retirement is is_active = false, which the table edits
  // directly. There is no DELETE policy either; this mirrors that.
  return {
    createLeaveType: createMutation.mutateAsync,
    updateLeaveType: updateMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
  };
}

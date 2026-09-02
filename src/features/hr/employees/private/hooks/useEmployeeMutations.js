import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkDeleteEmployees,
  bulkUpdateEmployees,
} from "../api/employeeMutations";
import { applyEmployeeStatusTransition } from "../api/employeeStatusTransitionMutations";

import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "employee",
  constraints: {
    email_work: "An employee with this work email already exists.",
    email_personal: "An employee with this personal email already exists.",
    employee_code: "This Employee Code is already assigned.",
    profile_id: "This Profile is already assigned.",
  },
};

export default function useEmployeeMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  /**
   * CREATE
   */
  const createMutation = useMutation({
    mutationFn: createEmployee,

    onMutate: () => {
      showMessage("Creating employee...", "loading");
    },

    onSuccess: () => {
      showMessage("Employee created", "success");

      queryClient.invalidateQueries({
        queryKey: ["employees"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  /**
   * UPDATE
   */
  const updateMutation = useMutation({
    mutationFn: updateEmployee,

    onMutate: () => {
      showMessage("Updating employee...", "loading");
    },

    onSuccess: () => {
      showMessage("Employee updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["employees"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  /**
   * BULK UPDATE
   */
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, fields }) => bulkUpdateEmployees(ids, fields),

    onMutate: () => {
      showMessage("Updating employees...", "loading");
    },

    onSuccess: () => {
      showMessage("Employees updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["employees"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  /**
   * DELETE
   */
  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,

    onMutate: () => {
      showMessage("Deleting employee...", "loading");
    },

    onSuccess: () => {
      showMessage("Employee deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["employees"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  /**
   * GUIDED STATUS TRANSITION -- also invalidates lifecycleCases queries,
   * since this is the primary path that opens/affects an offboarding case
   * now (see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2).
   */
  const statusTransitionMutation = useMutation({
    mutationFn: applyEmployeeStatusTransition,

    onMutate: () => {
      showMessage("Updating employee status...", "loading");
    },

    onSuccess: () => {
      showMessage("Employee status updated", "success");

      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["lifecycleCases"] });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  /**
   * BULK DELETE
   */
  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteEmployees,

    onMutate: () => {
      showMessage("Deleting employees...", "loading");
    },

    onSuccess: () => {
      showMessage("Employees deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["employees"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    createEmployee: createMutation.mutateAsync,
    updateEmployee: updateMutation.mutateAsync,
    deleteEmployee: deleteMutation.mutateAsync,
    bulkDeleteEmployees: bulkDeleteMutation.mutateAsync,
    bulkUpdateEmployees: bulkUpdateMutation.mutateAsync,
    applyEmployeeStatusTransition: statusTransitionMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    bulkDeleting: bulkDeleteMutation.isPending,
    bulkUpdating: bulkUpdateMutation.isPending,
    applyingStatusTransition: statusTransitionMutation.isPending,
  };
}

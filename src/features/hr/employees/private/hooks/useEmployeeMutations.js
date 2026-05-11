import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkDeleteEmployees,
  bulkUpdateEmployees,
} from "../api/employeeMutations";

import { useMessage } from "../../../../../context/MessageContext";

function getFriendlyError(err) {
  switch (err.code) {
    case "23505":
      if (err.message.includes("email_work")) {
        return "An employee with this work email already exists.";
      }

      if (err.message.includes("email_personal")) {
        return "An employee with this personal email already exists.";
      }

      if (err.message.includes("employee_code")) {
        return "This Employee Code is already assigned.";
      }

      if (err.message.includes("profile_id")) {
        return "This Profile is already assigned.";
      }

      return "A record with this information already exists.";

    case "23503":
      return "This record is linked to other data and cannot be changed or removed.";

    case "42501":
      return "Permission denied. You aren't authorized to modify employees.";

    default:
      return err.message || "Something went wrong.";
  }
}

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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
    },
  });

  return {
    createEmployee: createMutation.mutateAsync,
    updateEmployee: updateMutation.mutateAsync,
    deleteEmployee: deleteMutation.mutateAsync,
    bulkDeleteEmployees: bulkDeleteMutation.mutateAsync,
    bulkUpdateEmployees: bulkUpdateMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    bulkDeleting: bulkDeleteMutation.isPending,
    bulkUpdating: bulkUpdateMutation.isPending,
  };
}

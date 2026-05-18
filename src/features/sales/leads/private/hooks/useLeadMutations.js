import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createLead,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  bulkUpdateLeads,
} from "../api/leadsMutationsService";
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

export default function useLeadMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  /**
   * CREATE
   */
  const createMutation = useMutation({
    mutationFn: createLead,

    onMutate: () => {
      showMessage("Creating lead...", "loading");
    },

    onSuccess: () => {
      showMessage("Lead created", "success");

      queryClient.invalidateQueries({
        queryKey: ["sales_leads"],
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
    mutationFn: updateLead,

    onMutate: () => {
      showMessage("Updating lead...", "loading");
    },

    onSuccess: () => {
      showMessage("Lead updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["sales_leads"],
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
    mutationFn: ({ ids, fields }) => bulkUpdateLeads(ids, fields),

    onMutate: () => {
      showMessage("Updating leads...", "loading");
    },

    onSuccess: () => {
      showMessage("Leads updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["sales_leads"],
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
    mutationFn: deleteLead,

    onMutate: () => {
      showMessage("Deleting lead...", "loading");
    },

    onSuccess: () => {
      showMessage("Lead deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["sales_leads"],
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
    mutationFn: bulkDeleteLeads,

    onMutate: () => {
      showMessage("Deleting leads...", "loading");
    },

    onSuccess: () => {
      showMessage("Leads deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["sales_leads"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err), "error");
    },
  });

  return {
    createLead: createMutation.mutateAsync,
    updateLead: updateMutation.mutateAsync,
    deleteLead: deleteMutation.mutateAsync,
    bulkDeleteLeads: bulkDeleteMutation.mutateAsync,
    bulkUpdateLeads: bulkUpdateMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    bulkDeleting: bulkDeleteMutation.isPending,
    bulkUpdating: bulkUpdateMutation.isPending,
  };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createLead,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  bulkUpdateLeads,
} from "../api/leadsMutationsService";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "lead" };

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
      showMessage(getFriendlyError(err, errorConfig), "error");
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
      showMessage(getFriendlyError(err, errorConfig), "error");
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
      showMessage(getFriendlyError(err, errorConfig), "error");
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
      showMessage(getFriendlyError(err, errorConfig), "error");
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
      showMessage(getFriendlyError(err, errorConfig), "error");
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

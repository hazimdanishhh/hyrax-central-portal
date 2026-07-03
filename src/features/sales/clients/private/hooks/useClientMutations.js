import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  bulkUpdateClients,
} from "../api/clientsMutationsService";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "client" };

export default function useClientMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  /**
   * CREATE
   */
  const createMutation = useMutation({
    mutationFn: createClient,

    onMutate: () => {
      showMessage("Creating client...", "loading");
    },

    onSuccess: () => {
      showMessage("Client created", "success");

      queryClient.invalidateQueries({
        queryKey: ["clients"],
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
    mutationFn: updateClient,

    onMutate: () => {
      showMessage("Updating client...", "loading");
    },

    onSuccess: () => {
      showMessage("Client updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["clients"],
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
    mutationFn: ({ ids, fields }) => bulkUpdateClients(ids, fields),

    onMutate: () => {
      showMessage("Updating clients...", "loading");
    },

    onSuccess: () => {
      showMessage("Clients updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["clients"],
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
    mutationFn: deleteClient,

    onMutate: () => {
      showMessage("Deleting client...", "loading");
    },

    onSuccess: () => {
      showMessage("Client deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["clients"],
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
    mutationFn: bulkDeleteClients,

    onMutate: () => {
      showMessage("Deleting clients...", "loading");
    },

    onSuccess: () => {
      showMessage("Clients deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["clients"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    createClient: createMutation.mutateAsync,
    updateClient: updateMutation.mutateAsync,
    deleteClient: deleteMutation.mutateAsync,
    bulkDeleteClients: bulkDeleteMutation.mutateAsync,
    bulkUpdateClients: bulkUpdateMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    bulkDeleting: bulkDeleteMutation.isPending,
    bulkUpdating: bulkUpdateMutation.isPending,
  };
}

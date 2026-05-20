import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  bulkUpdateClients,
} from "../api/clientsMutationsService";
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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

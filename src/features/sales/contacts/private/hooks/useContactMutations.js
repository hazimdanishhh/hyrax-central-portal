import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkUpdateContacts,
} from "../api/contactMutationsService";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "contact" };

export default function useContactMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  /**
   * CREATE
   */
  const createMutation = useMutation({
    mutationFn: createContact,

    onMutate: () => {
      showMessage("Creating contact...", "loading");
    },

    onSuccess: () => {
      showMessage("Contact created", "success");

      queryClient.invalidateQueries({
        queryKey: ["client_contacts"],
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
    mutationFn: updateContact,

    onMutate: () => {
      showMessage("Updating contact...", "loading");
    },

    onSuccess: () => {
      showMessage("Contact updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["client_contacts"],
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
    mutationFn: ({ ids, fields }) => bulkUpdateContacts(ids, fields),

    onMutate: () => {
      showMessage("Updating contacts...", "loading");
    },

    onSuccess: () => {
      showMessage("Contacts updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["client_contacts"],
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
    mutationFn: deleteContact,

    onMutate: () => {
      showMessage("Deleting contact...", "loading");
    },

    onSuccess: () => {
      showMessage("Contact deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["client_contacts"],
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
    mutationFn: bulkDeleteContacts,

    onMutate: () => {
      showMessage("Deleting contacts...", "loading");
    },

    onSuccess: () => {
      showMessage("Contacts deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["client_contacts"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    createContact: createMutation.mutateAsync,
    updateContact: updateMutation.mutateAsync,
    deleteContact: deleteMutation.mutateAsync,
    bulkDeleteContacts: bulkDeleteMutation.mutateAsync,
    bulkUpdateContacts: bulkUpdateMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    bulkDeleting: bulkDeleteMutation.isPending,
    bulkUpdating: bulkUpdateMutation.isPending,
  };
}

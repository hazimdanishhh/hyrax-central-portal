import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkUpdateContacts,
} from "../api/contactMutationsService";
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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
      showMessage(getFriendlyError(err), "error");
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

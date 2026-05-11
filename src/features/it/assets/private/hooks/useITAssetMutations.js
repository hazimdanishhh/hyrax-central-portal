// features/it/assets/private/hooks/useITAssetMutations.js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAsset,
  updateAsset,
  deleteAsset,
  bulkDeleteAssets,
  bulkUpdateAssets,
} from "../api/itAssetMutations";
import { useMessage } from "../../../../../context/MessageContext";

/**
 * Friendly DB Errors
 */
function getFriendlyError(err) {
  switch (err.code) {
    case "23505":
      if (err.message.includes("serial_number")) {
        return "An asset with this serial number already exists.";
      }

      if (err.message.includes("asset_tag")) {
        return "This asset tag is already assigned.";
      }

      return "A record with this information already exists.";

    case "23503":
      return "This record is linked to other data and cannot be changed or removed.";

    case "42501":
      return "Permission denied. You aren't authorized to modify IT assets.";

    default:
      return err.message || "Something went wrong.";
  }
}

export default function useITAssetMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  /**
   * CREATE
   */
  const createMutation = useMutation({
    mutationFn: createAsset,

    onMutate: () => {
      showMessage("Creating asset...", "loading");
    },

    onSuccess: () => {
      showMessage("Asset created", "success");

      queryClient.invalidateQueries({
        queryKey: ["it-assets"],
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
    mutationFn: updateAsset,

    onMutate: () => {
      showMessage("Updating asset...", "loading");
    },

    onSuccess: () => {
      showMessage("Asset updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["it-assets"],
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
    mutationFn: ({ ids, fields }) => bulkUpdateAssets(ids, fields),

    onMutate: () => {
      showMessage("Updating assets...", "loading");
    },

    onSuccess: () => {
      showMessage("Assets updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["it-assets"],
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
    mutationFn: deleteAsset,

    onMutate: () => {
      showMessage("Deleting asset...", "loading");
    },

    onSuccess: () => {
      showMessage("Asset deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["it-assets"],
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
    mutationFn: bulkDeleteAssets,

    onMutate: () => {
      showMessage("Deleting assets...", "loading");
    },

    onSuccess: () => {
      showMessage("Assets deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["it-assets"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err), "error");
    },
  });

  return {
    createAsset: createMutation.mutateAsync,
    updateAsset: updateMutation.mutateAsync,
    deleteAsset: deleteMutation.mutateAsync,
    bulkDeleteAssets: bulkDeleteMutation.mutateAsync,
    bulkUpdateAssets: bulkUpdateMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    bulkDeleting: bulkDeleteMutation.isPending,
    bulkUpdating: bulkUpdateMutation.isPending,
  };
}

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
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "IT asset",
  constraints: {
    serial_number: "An asset with this serial number already exists.",
    asset_tag: "This asset tag is already assigned.",
  },
};

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
        queryKey: ["itAssets"],
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
    mutationFn: updateAsset,

    onMutate: () => {
      showMessage("Updating asset...", "loading");
    },

    onSuccess: () => {
      showMessage("Asset updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["itAssets"],
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
    mutationFn: ({ ids, fields }) => bulkUpdateAssets(ids, fields),

    onMutate: () => {
      showMessage("Updating assets...", "loading");
    },

    onSuccess: () => {
      showMessage("Assets updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["itAssets"],
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
    mutationFn: deleteAsset,

    onMutate: () => {
      showMessage("Deleting asset...", "loading");
    },

    onSuccess: () => {
      showMessage("Asset deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["itAssets"],
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
    mutationFn: bulkDeleteAssets,

    onMutate: () => {
      showMessage("Deleting assets...", "loading");
    },

    onSuccess: () => {
      showMessage("Assets deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["itAssets"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfile, deleteProfile } from "../api/profileMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "user" };

export default function useProfileMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  /**
   * UPDATE
   */
  const updateMutation = useMutation({
    mutationFn: updateProfile,

    onMutate: () => {
      showMessage("Updating user...", "loading");
    },

    onSuccess: () => {
      showMessage("User updated", "success");

      queryClient.invalidateQueries({
        queryKey: ["users"],
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
    mutationFn: deleteProfile,

    onMutate: () => {
      showMessage("Deleting user...", "loading");
    },

    onSuccess: () => {
      showMessage("User deleted", "success");

      queryClient.invalidateQueries({
        queryKey: ["users"],
      });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    updateProfile: updateMutation.mutateAsync,
    deleteProfile: deleteMutation.mutateAsync,

    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}

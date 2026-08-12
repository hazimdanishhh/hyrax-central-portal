import { useMutation } from "@tanstack/react-query";
import { uploadAvatarPhoto } from "../../../services/storage/uploadAvatarPhoto";
import { updateOwnAvatar } from "../api/updateOwnAvatar";
import { useMessage } from "../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

export function useUpdateOwnAvatar(profileId, onSuccess) {
  const { showMessage } = useMessage();

  const mutation = useMutation({
    mutationFn: async (file) => {
      const uploaded = await uploadAvatarPhoto(file, profileId);
      return updateOwnAvatar({ id: profileId, avatar_url: uploaded.url });
    },

    onMutate: () => {
      showMessage("Updating profile picture...", "loading");
    },

    onSuccess: () => {
      showMessage("Profile picture updated", "success");
      onSuccess?.();
    },

    onError: (err) => {
      showMessage(
        getFriendlyError(err, { entity: "profile picture" }),
        "error",
      );
    },
  });

  return {
    updateAvatar: mutation.mutateAsync,
    updating: mutation.isPending,
  };
}

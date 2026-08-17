import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncTaskDocumentLinks } from "../api/taskDocumentsMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

export default function useTaskDocumentMutations(projectId) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const syncMutation = useMutation({
    mutationFn: syncTaskDocumentLinks,
    onMutate: () => showMessage("Updating documents...", "loading"),
    onSuccess: () => {
      showMessage("Documents updated", "success");
      queryClient.invalidateQueries({ queryKey: ["tasksByProject", projectId] });
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["projectDocuments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["myDocuments"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, { entity: "task document" }), "error"),
  });

  return {
    syncDocumentLinks: syncMutation.mutateAsync,
    syncing: syncMutation.isPending,
  };
}

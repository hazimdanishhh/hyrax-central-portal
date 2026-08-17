import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attachProjectDocuments, deleteDocument } from "../api/documentMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

export default function useDocumentMutations(projectId) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  function invalidateDocumentQueries() {
    queryClient.invalidateQueries({ queryKey: ["tasksByProject", projectId] });
    queryClient.invalidateQueries({ queryKey: ["myTasks"] });
    queryClient.invalidateQueries({ queryKey: ["projectDocuments", projectId] });
    queryClient.invalidateQueries({ queryKey: ["myDocuments"] });
  }

  const attachMutation = useMutation({
    mutationFn: attachProjectDocuments,
    onMutate: () => showMessage("Attaching document...", "loading"),
    onSuccess: () => {
      showMessage("Document attached", "success");
      invalidateDocumentQueries();
    },
    onError: (err) => showMessage(getFriendlyError(err, { entity: "document" }), "error"),
  });

  const removeMutation = useMutation({
    mutationFn: deleteDocument,
    onMutate: () => showMessage("Removing document...", "loading"),
    onSuccess: () => {
      showMessage("Document removed", "success");
      invalidateDocumentQueries();
    },
    onError: (err) => showMessage(getFriendlyError(err, { entity: "document" }), "error"),
  });

  return {
    attachDocuments: attachMutation.mutateAsync,
    attaching: attachMutation.isPending,
    removeDocument: removeMutation.mutateAsync,
    removing: removeMutation.isPending,
  };
}

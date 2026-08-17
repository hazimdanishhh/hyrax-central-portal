import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncTaskAssignees } from "../api/taskAssigneesMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

export default function useTaskAssigneeMutations(projectId) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const syncMutation = useMutation({
    mutationFn: ({ taskId, employeeIds }) => syncTaskAssignees(taskId, employeeIds),
    onMutate: () => showMessage("Updating assignees...", "loading"),
    onSuccess: () => {
      showMessage("Assignees updated", "success");
      queryClient.invalidateQueries({ queryKey: ["tasksByProject", projectId] });
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
    },
    onError: (err) => showMessage(getFriendlyError(err, { entity: "task assignee" }), "error"),
  });

  return {
    syncAssignees: syncMutation.mutateAsync,
    syncing: syncMutation.isPending,
  };
}

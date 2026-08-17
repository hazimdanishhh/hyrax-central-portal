import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTask, updateTask, deleteTask } from "../api/taskMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "task",
  constraints: {
    tasks_title_not_blank: "Task title cannot be blank.",
  },
};

export default function useTaskMutations(projectId) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tasksByProject", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] }); // progress % recomputes
    queryClient.invalidateQueries({ queryKey: ["myTasks"] });
  };

  const createMutation = useMutation({
    mutationFn: createTask,
    onMutate: () => showMessage("Creating task...", "loading"),
    onSuccess: () => {
      showMessage("Task created", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: updateTask,
    onMutate: () => showMessage("Updating task...", "loading"),
    onSuccess: () => {
      showMessage("Task updated", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: () => showMessage("Deleting task...", "loading"),
    onSuccess: () => {
      showMessage("Task deleted", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    createTask: createMutation.mutateAsync,
    updateTask: updateMutation.mutateAsync,
    deleteTask: deleteMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}

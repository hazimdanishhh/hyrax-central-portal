import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createProject,
  updateProject,
  deleteProject,
  transferProjectOwnership,
} from "../api/projectMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "project",
  constraints: {
    projects_name_not_blank: "Project name cannot be blank.",
    projects_dates_sane: "Target end date cannot be before the start date.",
    projects_completed_after_start: "Completed date cannot be before the start date.",
  },
};

export default function useProjectMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const invalidateProjects = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const createMutation = useMutation({
    mutationFn: createProject,
    onMutate: () => showMessage("Creating project...", "loading"),
    onSuccess: () => {
      showMessage("Project created", "success");
      invalidateProjects();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: updateProject,
    onMutate: () => showMessage("Updating project...", "loading"),
    onSuccess: (data) => {
      showMessage("Project updated", "success");
      invalidateProjects();
      queryClient.invalidateQueries({ queryKey: ["project", data.id] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onMutate: () => showMessage("Deleting project...", "loading"),
    onSuccess: () => {
      showMessage("Project deleted", "success");
      invalidateProjects();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: transferProjectOwnership,
    onMutate: () => showMessage("Transferring ownership...", "loading"),
    onSuccess: (_data, variables) => {
      showMessage("Ownership transferred", "success");
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    createProject: createMutation.mutateAsync,
    updateProject: updateMutation.mutateAsync,
    deleteProject: deleteMutation.mutateAsync,
    transferProjectOwnership: transferOwnershipMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    transferringOwnership: transferOwnershipMutation.isPending,
  };
}

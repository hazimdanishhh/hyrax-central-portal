import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  syncProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
} from "../api/projectMembersMutations";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "project member" };

export default function useProjectMemberMutations(projectId) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const syncMutation = useMutation({
    mutationFn: (roleAssignments) => syncProjectMembers(projectId, roleAssignments),
    onMutate: () => showMessage("Updating project members...", "loading"),
    onSuccess: () => {
      showMessage("Project members updated", "success");
      invalidateProject();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (employeeId) => removeProjectMember(projectId, employeeId),
    onMutate: () => showMessage("Removing member...", "loading"),
    onSuccess: () => {
      showMessage("Member removed", "success");
      invalidateProject();
    },
    // Deliberately no generic-only message here -- the DB's own
    // "Transfer ownership before removing the owner..." / "Cannot remove
    // this member: still assigned to incomplete task(s): ..." exception
    // text IS the friendly message; getFriendlyError's default branch
    // (raw err.message) surfaces it directly.
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ employeeId, role }) => updateProjectMemberRole(projectId, employeeId, role),
    onMutate: () => showMessage("Updating role...", "loading"),
    onSuccess: () => {
      showMessage("Role updated", "success");
      invalidateProject();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    syncMembers: syncMutation.mutateAsync,
    removeMember: removeMutation.mutateAsync,
    updateMemberRole: updateRoleMutation.mutateAsync,

    syncing: syncMutation.isPending,
    removing: removeMutation.isPending,
    updatingRole: updateRoleMutation.isPending,
  };
}

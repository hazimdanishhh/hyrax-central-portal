import { useState } from "react";

/**
 * Shared confirm-modal bookkeeping for a TaskCard's quick status-transition
 * buttons (Start/Complete/Cancel) -- used identically by ProjectTasksTab and
 * MyTasks so this isn't duplicated per page. Mirrors Sales Leads' own
 * handleRequestAction/pendingAction/ActionModal recipe, simplified since a
 * status change here needs no extra form fields, just a confirm.
 *
 * Takes the calling page's own `updateTask` mutation function (from
 * useTaskMutations) rather than calling that hook itself, so the caller
 * keeps control of which projectId that hook was instantiated with (for
 * cache invalidation) -- this hook only owns the modal/pending-action
 * bookkeeping, not the mutation itself.
 */
export function useTaskStatusAction(updateTask) {
  const [pendingAction, setPendingAction] = useState(null); // { task, nextStatus, label } | null

  function requestStatusChange(task, nextStatus, label) {
    setPendingAction({ task, nextStatus, label });
  }

  function cancelAction() {
    setPendingAction(null);
  }

  async function confirmAction() {
    if (!pendingAction) return;
    await updateTask({ id: pendingAction.task.id, status: pendingAction.nextStatus });
    setPendingAction(null);
  }

  return {
    pendingAction,
    modalOpen: !!pendingAction,
    requestStatusChange,
    cancelAction,
    confirmAction,
  };
}

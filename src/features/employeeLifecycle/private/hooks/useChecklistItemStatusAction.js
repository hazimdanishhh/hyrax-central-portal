import { useState } from "react";

/**
 * Shared confirm-modal bookkeeping for a ChecklistItemCard's quick
 * Mark-Done/Undo action -- mirrors useTaskStatusAction.js's exact shape
 * (requestStatusChange -> ActionModal confirm -> confirmAction). Takes the
 * calling page's own updateChecklistItemStatus mutation function rather
 * than calling the hook itself, same separation of concerns as the task
 * version.
 */
export function useChecklistItemStatusAction(updateChecklistItemStatus, actingProfileId) {
  const [pendingAction, setPendingAction] = useState(null); // { item, nextStatus, label } | null

  function requestStatusChange(item, nextStatus, label) {
    setPendingAction({ item, nextStatus, label });
  }

  function cancelAction() {
    setPendingAction(null);
  }

  async function confirmAction() {
    if (!pendingAction) return;
    await updateChecklistItemStatus({
      id: pendingAction.item.id,
      status: pendingAction.nextStatus,
      notes: pendingAction.item.notes,
      actingProfileId,
    });
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

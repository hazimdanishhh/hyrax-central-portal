import { useState } from "react";

/**
 * Shared save/delete confirmation-modal state for CRUD list pages.
 *
 * Every CRUD page needs: "which row is pending delete", "which row is pending
 * save", "what kind of confirmation is this", and a modal open flag. This was
 * previously copy-pasted verbatim across every page controller. Pages keep
 * their own `selectedRow`/`sidebarOpen` (some derive it from the URL, others
 * from local state) and their own `handleConfirmAction` (mutation calls differ
 * per entity) — only the modal-request bookkeeping lives here.
 */
export default function useCrudActionState() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [modalType, setModalType] = useState(null); // "save" | "delete" | ...
  const [pendingSaveRow, setPendingSaveRow] = useState(null);

  function handleRequestSave(data) {
    setPendingSaveRow(data);
    setModalType("save");
    setModalOpen(true);
  }

  function handleRequestDelete(row) {
    setPendingDeleteRow(row);
    setSelectedRowId(row.id);
    setModalType("delete");
    setModalOpen(true);
  }

  function closeActionModal() {
    setModalOpen(false);
    setSelectedRowId(null);
    setPendingDeleteRow(null);
    setModalType(null);
    setPendingSaveRow(null);
  }

  return {
    modalOpen,
    setModalOpen,
    selectedRowId,
    pendingDeleteRow,
    modalType,
    setModalType,
    pendingSaveRow,
    handleRequestSave,
    handleRequestDelete,
    closeActionModal,
  };
}

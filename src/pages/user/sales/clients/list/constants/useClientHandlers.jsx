import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getActionConfig } from "./actionConfig"; // <-- Make sure path is correct relative to this folder
import { useSidebar } from "../../../../../../context/SidebarContext";
import { useModal } from "../../../../../../context/ActionModalContext";
import useClientMutations from "../../../../../../features/sales/clients/private/hooks/useClientMutations";

export function useClientHandlers({ columns }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sidebar, openSidebar, updateSidebar, closeSidebar } = useSidebar();
  const { openModal } = useModal();

  // Absorb mutations
  const {
    createClient,
    updateClient,
    deleteClient,
    creating,
    updating,
    deleting,
    bulkUpdating,
  } = useClientMutations();

  const isSaving = creating || updating || bulkUpdating;

  // ==============
  // HANDLE REQUEST SAVE
  // ==============
  function handleRequestSave(data) {
    const isUpdating = !!data.id;

    openModal({
      ...getActionConfig.save,
      onConfirm: async () => {
        if (isUpdating) {
          await updateClient(data);
        } else {
          await createClient(data);
        }
        await queryClient.invalidateQueries({ queryKey: ["clients"] });
        closeSidebar();
      },
    });
  }

  // ==============
  // HANDLE REQUEST DELETE
  // ==============
  function handleRequestDelete(client) {
    openModal({
      ...getActionConfig.delete,
      onConfirm: async () => {
        await deleteClient(client.id);
        await queryClient.invalidateQueries({ queryKey: ["clients"] });
        closeSidebar();
      },
    });
  }

  // ==============
  // HANDLE CREATE
  // ==============
  function handleCreate() {
    navigate(`/app/sales/clients/list/new?${searchParams.toString()}`);

    openSidebar({
      title: "Add Client",
      icon: PlusCircleIcon,
      rowData: {},
      columns,
      isEditing: true,
      creating: true,
      saving: isSaving,
      deleting: deleting,
      onSave: handleRequestSave,
      onDelete: handleRequestDelete,
      onClose: () => {
        navigate(`/app/sales/clients/list?${searchParams.toString()}`);
      },
    });
  }

  // ==============
  // HANDLE EDIT / VIEW
  // ==============
  function handleEdit(client, startInEditMode = true) {
    navigate(`/app/sales/clients/list/${client.id}?${searchParams.toString()}`);

    openSidebar({
      title: startInEditMode ? "Edit Client" : "View Client",
      icon: PencilSimpleLineIcon,
      rowData: client,
      columns,
      isEditing: startInEditMode,
      creating: false,
      saving: isSaving,
      deleting: deleting,
      onSave: handleRequestSave,
      onDelete: handleRequestDelete,
      onClose: () => {
        navigate(`/app/sales/clients/list/?${searchParams.toString()}`);
      },
      onCancel: () => {
        closeSidebar();
      },
    });
  }

  return {
    handleCreate,
    handleEdit,
    isSaving,
    deleting,
  };
}

import { PencilSimpleLineIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import LeadSidebar from "../../../../../../components/sales/leads/leadSidebar/LeadSidebar";
import { useSidebar } from "../../../../../../context/SidebarContext";
import { useModal } from "../../../../../../context/ActionModalContext";
import useLeadMutations from "../../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { getActionConfig } from "./actionConfig";

export function useLeadHandlers({ columns }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sidebar, openSidebar, updateSidebar, closeSidebar } = useSidebar();
  const { openModal } = useModal();

  // Absorb the mutations into the hook!
  const {
    createLead,
    updateLead,
    deleteLead,
    creating,
    updating,
    deleting,
    bulkUpdating,
  } = useLeadMutations();

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
          await updateLead(data);
        } else {
          await createLead(data);
        }
        await queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
        closeSidebar();
      },
    });
  }

  // ==============
  // HANDLE REQUEST DELETE
  // ==============
  function handleRequestDelete(lead) {
    openModal({
      ...getActionConfig.delete,
      onConfirm: async () => {
        await deleteLead(lead.id);
        await queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
        closeSidebar();
      },
    });
  }

  // ==============
  // HANDLE REQUEST ACTION (Stages/Hold/Cancel)
  // ==============
  function handleRequestAction(action) {
    const isHoldAction =
      action?.type === "toggle_hold" && action?.payload?.is_on_hold === true;
    const isLostAction =
      action?.type === "stage_change" && action?.payload?.stage === "LOST";
    const isCancelAction = action?.type === "cancel";

    let dynamicPlaceholder = "Enter reason...";
    if (isHoldAction) dynamicPlaceholder = "Why is this lead on hold?";
    if (isLostAction) dynamicPlaceholder = "Why was this lead lost?";
    if (isCancelAction)
      dynamicPlaceholder = "Why is this lead being cancelled?";

    openModal({
      ...getActionConfig[action.type],
      requireInput: isHoldAction || isLostAction || isCancelAction,
      inputPlaceholder: dynamicPlaceholder,

      onConfirm: async (reason) => {
        const payloadToSubmit = { ...action.payload };

        if (isCancelAction) payloadToSubmit.cancel_reason = reason;
        if (isHoldAction) payloadToSubmit.hold_reason = reason;
        if (isLostAction) payloadToSubmit.lose_reason = reason;

        if (action.type === "toggle_hold" && !action.payload.is_on_hold) {
          payloadToSubmit.hold_reason = null;
        }
        if (action.type === "cancel") {
          payloadToSubmit.is_on_hold = false;
          payloadToSubmit.hold_reason = null;
        }
        if (action.type === "stage_change" && action.payload.stage !== "LOST") {
          payloadToSubmit.lose_reason = null;
        }

        await updateLead({ id: payloadToSubmit.id, ...payloadToSubmit });
        await queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
        closeSidebar();
      },
    });
  }

  // ==============
  // HANDLE CREATE
  // ==============
  function handleCreate() {
    navigate(`/app/sales/leads/list/new?${searchParams.toString()}`);
    openSidebar({
      title: "Add Lead",
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
        navigate(`/app/sales/leads/list?${searchParams.toString()}`);
      },
    });
  }

  // ==============
  // HANDLE EDIT / VIEW
  // ==============
  function handleEdit(lead, startInEditMode = false) {
    navigate(`/app/sales/leads/list/${lead.id}?${searchParams.toString()}`);
    openSidebar({
      title: startInEditMode ? "Edit Lead" : "View Lead",
      icon: PencilSimpleLineIcon,
      rowData: lead,
      columns,
      isEditing: startInEditMode,
      creating: false,
      saving: isSaving,
      deleting: deleting,
      onSave: handleRequestSave,
      onDelete: handleRequestDelete,
      onClose: () => {
        navigate(`/app/sales/leads/list?${searchParams.toString()}`);
      },
      onCancel: () => {
        updateSidebar({ isEditing: false, title: "View Lead" });
      },
      children: (
        <LeadSidebar
          selectedRow={lead}
          onRequestAction={handleRequestAction}
          isEditing={sidebar.isEditing}
          setIsEditing={(value) =>
            updateSidebar({
              isEditing: value,
              title: value ? "Edit Lead" : "View Lead",
            })
          }
        />
      ),
    });
  }

  // Return the functions and states the main component actually needs
  return {
    handleCreate,
    handleEdit,
    isSaving,
    deleting,
  };
}

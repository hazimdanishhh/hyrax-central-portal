import { PencilSimpleLineIcon } from "@phosphor-icons/react";

export function getClientSidebarConfig({
  client = {},
  columns,
  onSave,
  onDelete,
  isSaving,
  deleting,
  navigateBack,
  onCancel,
}) {
  return {
    title: client?.id ? "Edit Client" : "Add Client",

    icon: PencilSimpleLineIcon,

    rowData: client,

    columns,

    onSave,
    onDelete,

    saving: isSaving,
    deleting,

    creating: !client?.id,

    isEditing: client?.id,

    onClose: navigateBack,
    onCancel,
  };
}

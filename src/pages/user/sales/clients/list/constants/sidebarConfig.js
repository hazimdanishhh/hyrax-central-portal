import { PencilSimpleLineIcon } from "@phosphor-icons/react";

export function getClientSidebarConfig({
  client = {},
  columns,
  onSave,
  onDelete,
  isSaving,
  deleting,
  navigateBack,
  isEditing,
  onCancel,
  children,
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

    isEditing: isEditing !== undefined ? isEditing : !client?.id,

    onCancel,
    children,

    onClose: navigateBack,
  };
}

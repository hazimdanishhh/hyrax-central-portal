import { PencilSimpleLineIcon } from "@phosphor-icons/react";

export function getLeadSidebarConfig({
  lead,
  columns,
  onSave,
  onDelete,
  onCancel,
  saving,
  deleting,
  children,
}) {
  return {
    title: lead?.id ? "Edit Lead" : "Add Lead",

    icon: PencilSimpleLineIcon,

    rowData: lead,

    columns,

    onSave,
    onDelete,
    onCancel,

    saving,
    deleting,

    creating: !lead?.id,

    isEditing: !lead?.id,

    children,
  };
}

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// editable = boolean

export const leadsPoEditConfig = () => [
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "actual_revenue",
    label: "Actual Revenue (RM)",
    getValue: "actual_revenue",
    editable: true,
    editor: "number",
    min: 0,
    required: true,
  },
  {
    key: "po_number",
    label: "PO Number (SAP)",
    getValue: "po_number",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "po_document_url",
    label: "Purchase Order Document",
    getValue: "po_document_url",
    editable: true,
    editor: "drivePicker",
    required: true,
  },
];

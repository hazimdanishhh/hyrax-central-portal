export const getTableConfig = () => [
  {
    key: "full_name",
    label: "Contact Name",
    getValue: "full_name",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "email",
    label: "Email",
    getValue: "email",
    editable: true,
    editor: "text",
  },
  {
    key: "phone",
    label: "Phone",
    getValue: "phone",
    editable: true,
    editor: "text",
  },
  {
    key: "position",
    label: "Position",
    getValue: "position",
    editable: true,
    editor: "text",
  },
];

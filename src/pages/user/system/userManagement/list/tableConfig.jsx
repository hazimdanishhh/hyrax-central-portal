// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const usersTableConfig = ({ roles, departments }) => [
  {
    key: "id",
    label: "ID",
    getValue: (profile) => profile.id,
    editable: false,
    editor: "text",
  },
  {
    key: "role_id",
    label: "Role",
    getValue: (profile) => profile.role?.id,
    displayValue: (profile) => profile.role?.name,
    editable: true,
    editor: "select",
    options: roles.map((p) => ({
      label: p.name,
      value: p.id,
    })),
  },
  {
    key: "department_id",
    label: "Department",
    getValue: (profile) => profile.department?.id,
    displayValue: (profile) => profile.department?.name,
    editable: true,
    editor: "select",
    options: departments.map((n) => ({
      label: n.name,
      value: n.id,
    })),
  },
  {
    key: "full_name",
    label: "Full Name",
    getValue: (profile) => profile.full_name,
    editable: false,
    editor: "text",
  },
  {
    key: "email",
    label: "Email",
    getValue: (profile) => profile.email,
    editable: false,
    editor: "text",
  },
  {
    key: "avatar_url",
    label: "Attendance Photo",
    getValue: (profile) => profile.avatar_url,
    editable: true,
    editor: "image",
  },
  {
    key: "created_at",
    label: "Created At",
    getValue: (profile) => profile.created_at,
    editable: false,
    editor: "dateTime",
  },
  {
    key: "updated_at",
    label: "Updated At",
    getValue: (profile) => profile.updated_at,
    editable: false,
    editor: "dateTime",
  },
];

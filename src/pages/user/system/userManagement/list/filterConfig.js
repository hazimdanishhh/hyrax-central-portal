export function getUsersFilterConfig({ roles, departments }) {
  return [
    {
      key: "role",
      label: "Role",
      options: [
        { label: "No Role", value: "__null__" },
        ...roles.map((e) => ({ label: e.name, value: e.id })),
      ],
    },
    {
      key: "department",
      label: "Department",
      options: [
        { label: "No Department", value: "__null__" },
        ...departments.map((d) => ({ label: d.name, value: d.id })),
      ],
    },
  ];
}

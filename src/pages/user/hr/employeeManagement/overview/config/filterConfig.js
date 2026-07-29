export function getFilterConfig({ departments }) {
  return [
    {
      key: "department",
      label: "Department",
      options: (departments || []).map((d) => ({
        label: d.name,
        value: d.id,
      })),
    },
  ];
}

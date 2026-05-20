export function getFilterConfig({ industries }) {
  return [
    {
      key: "industry",
      label: "Industry",
      options: industries.map((c) => ({ label: c.name, value: c.id })),
    },
  ];
}

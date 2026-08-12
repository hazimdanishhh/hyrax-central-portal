export function getSalesRepMappingFilterConfig() {
  return [
    {
      key: "unmapped",
      label: "Mapping Status",
      options: [{ label: "Unmapped only", value: "true" }],
    },
    {
      key: "isActive",
      label: "SAP Status",
      options: [
        { label: "Active", value: "Y" },
        { label: "Inactive", value: "N" },
      ],
    },
  ];
}

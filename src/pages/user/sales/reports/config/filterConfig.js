export function getFilterConfig({ owners }) {
  return [
    {
      key: "owner",
      label: "Owner",
      options: owners.map((o) => ({ label: o.full_name, value: o.id })),
    },
    {
      key: "productType",
      label: "Product Type",
      options: [
        { label: "TRANSFORMER OILS", value: "TRANSFORMER OILS" },
        { label: "LUBRICANTS", value: "LUBRICANTS" },
        { label: "MIXED", value: "MIXED" },
      ],
    },
  ];
}

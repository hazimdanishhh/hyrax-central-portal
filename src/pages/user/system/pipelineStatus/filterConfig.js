export function getPipelineRunLogFilterConfig() {
  return [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Success", value: "success" },
        { label: "Error", value: "error" },
      ],
    },
  ];
}

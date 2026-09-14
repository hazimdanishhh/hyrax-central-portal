export function getFilterConfig({ departments, workLocations }) {
  return [
    {
      key: "department",
      label: "Department",
      options: (departments || []).map((d) => ({
        label: d.name,
        value: d.id,
      })),
    },
    {
      // Same shape as Attendance Management Overview's Work Location filter.
      key: "workLocation",
      label: "Work Location",
      options: (workLocations || []).map((w) => ({
        label: w.name,
        value: w.id,
      })),
    },
  ];
}

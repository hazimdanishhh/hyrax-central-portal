// pages/user/hr/hrReports/filterConfig.js
// Mirrors Employee Overview's own config/filterConfig.js exactly -- date
// range is handled generically by SearchFilterBar's enableDateRange prop,
// so department is the only dropdown filter this page needs.

export function getHrReportsFilterConfig({ departments, workLocations }) {
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
      key: "workLocation",
      label: "Work Location",
      options: (workLocations || []).map((w) => ({
        label: w.name,
        value: w.id,
      })),
    },
  ];
}

export function getITAssetsFilterConfig({
  categories,
  subcategories,
  statuses,
  conditions,
  operatingSystems,
  departments,
  employees,
  manufacturers,
}) {
  return [
    {
      key: "category",
      label: "Category",
      options: categories.map((c) => ({ label: c.name, value: c.id })),
    },
    {
      key: "subcategory",
      label: "Subcategory",
      options: subcategories.map((s) => ({ label: s.name, value: s.id })),
    },
    {
      key: "status",
      label: "Status",
      options: statuses.map((s) => ({ label: s.name, value: s.id })),
    },
    {
      key: "condition",
      label: "Condition",
      options: conditions.map((c) => ({ label: c.name, value: c.id })),
    },
    {
      key: "os",
      label: "OS",
      options: operatingSystems.map((o) => ({ label: o.name, value: o.id })),
    },
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => ({ label: d.name, value: d.id })),
    },
    {
      key: "employees",
      label: "Employee",
      options: employees.map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      key: "manufacturer",
      label: "Manufacturer",
      options: manufacturers.map((m) => ({ label: m.name, value: m.id })),
    },
    {
      key: "mdm",
      label: "MDM",
      options: [
        { label: "Enrolled", value: "Enrolled" },
        { label: "Not Enrolled", value: "Not Enrolled" },
        { label: "Pending Enrollment", value: "Pending Enrollment" },
        { label: "Retired", value: "Retired" },
      ],
    },
  ];
}

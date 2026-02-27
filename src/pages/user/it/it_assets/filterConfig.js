export function getITAssetsFilterConfig({
  categories,
  subcategories,
  statuses,
  conditions,
  operatingSystems,
  departments,
  employees,
}) {
  return [
    {
      key: "category",
      label: "Category",
      options: categories.map((c) => c.name),
    },
    {
      key: "subcategory",
      label: "Subcategory",
      options: subcategories.map((s) => s.name),
    },
    {
      key: "status",
      label: "Status",
      options: statuses.map((s) => s.name),
    },
    {
      key: "condition",
      label: "Condition",
      options: conditions.map((c) => c.name),
    },
    {
      key: "os",
      label: "OS",
      options: operatingSystems.map((o) => o.name),
    },
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => d.name),
    },
    {
      key: "employees",
      label: "Employee",
      options: employees.map((e) => e.full_name),
    },
    {
      key: "mdm",
      label: "MDM",
      options: ["Enrolled", "Not Enrolled", "Pending Enrollment", "Retired"],
    },
  ];
}

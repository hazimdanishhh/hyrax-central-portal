export function getEmployeesPublicFilterConfig({
  managers,
  departments,
  nationalities,
  employmentTypes,
}) {
  return [
    {
      key: "manager",
      label: "Manager",
      options: managers.map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => ({ label: d.name, value: d.id })),
    },
    {
      key: "nationality",
      label: "Nationality",
      options: nationalities.map((n) => ({ label: n.name, value: n.id })),
    },
    {
      key: "employmentType",
      label: "Employment Type",
      options: employmentTypes.map((e) => ({ label: e.name, value: e.id })),
    },
  ];
}

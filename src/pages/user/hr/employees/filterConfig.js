export function getEmployeesFilterConfig({
  departments,
  nationalities,
  identificationTypes,
  employmentTypes,
  terminationReasons,
  employmentStatuses,
}) {
  return [
    {
      key: "department",
      label: "Department",
      options: departments.map((d) => d.name),
    },
    {
      key: "nationality",
      label: "Nationality",
      options: nationalities.map((n) => n.name),
    },
    {
      key: "identificationType",
      label: "Identification Type",
      options: identificationTypes.map((i) => i.name),
    },
    {
      key: "employmentType",
      label: "Employment Type",
      options: employmentTypes.map((e) => e.name),
    },
    {
      key: "terminationReason",
      label: "Termination Reason",
      options: terminationReasons.map((t) => t.name),
    },
    {
      key: "employmentStatus",
      label: "Employment Status",
      options: employmentStatuses.map((e) => e.name),
    },
    {
      key: "maritalStatus",
      label: "Marital Status",
      options: [
        "Single",
        "Married (Spouse Not Working)",
        "Married (Spouse Working)",
        "Divorced",
        "Widowed",
      ],
    },
  ];
}

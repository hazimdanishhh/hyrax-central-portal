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
      options: departments.map((d) => ({ label: d.name, value: d.id })),
    },
    {
      key: "nationality",
      label: "Nationality",
      options: nationalities.map((n) => ({ label: n.name, value: n.id })),
    },
    {
      key: "identificationType",
      label: "Identification Type",
      options: identificationTypes.map((i) => ({ label: i.name, value: i.id })),
    },
    {
      key: "employmentType",
      label: "Employment Type",
      options: employmentTypes.map((e) => ({ label: e.name, value: e.id })),
    },
    {
      key: "terminationReason",
      label: "Termination Reason",
      options: terminationReasons.map((t) => ({ label: t.name, value: t.id })),
    },
    {
      key: "employmentStatus",
      label: "Employment Status",
      options: employmentStatuses.map((e) => ({ label: e.name, value: e.id })),
    },
    {
      key: "maritalStatus",
      label: "Marital Status",
      options: [
        { label: "Single", value: "Single" },
        {
          label: "Married (Spouse Not Working)",
          value: "Married (Spouse Not Working)",
        },
        {
          label: "Married (Spouse Working)",
          value: "Married (Spouse Working)",
        },
        {
          label: "Divorced",
          value: "Divorced",
        },
        {
          label: "Widowed",
          value: "Widowed",
        },
      ],
    },
  ];
}

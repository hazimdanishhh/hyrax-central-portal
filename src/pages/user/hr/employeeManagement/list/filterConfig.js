export function getEmployeesFilterConfig({
  managers,
  departments,
  nationalities,
  identificationTypes,
  employmentTypes,
  terminationReasons,
  employmentStatuses,
}) {
  return [
    {
      key: "manager",
      label: "Manager",
      options: [
        { label: "No Manager", value: "__null__" },
        ...managers.map((e) => ({ label: e.full_name, value: e.id })),
      ],
    },
    {
      key: "department",
      label: "Department",
      options: [
        { label: "No Department", value: "__null__" },
        ...departments.map((d) => ({ label: d.name, value: d.id })),
      ],
    },
    {
      key: "nationality",
      label: "Nationality",
      options: [
        { label: "No Nationality", value: "__null__" },
        ...nationalities.map((n) => ({ label: n.name, value: n.id })),
      ],
    },
    {
      key: "identificationType",
      label: "Identification Type",
      options: [
        { label: "No Identification Type", value: "__null__" },
        ...identificationTypes.map((i) => ({ label: i.name, value: i.id })),
      ],
    },
    {
      key: "employmentType",
      label: "Employment Type",
      options: [
        { label: "No Employment Type", value: "__null__" },
        ...employmentTypes.map((e) => ({ label: e.name, value: e.id })),
      ],
    },
    {
      key: "terminationReason",
      label: "Termination Reason",
      options: [
        { label: "No Termination Reason", value: "__null__" },
        ...terminationReasons.map((t) => ({ label: t.name, value: t.id })),
      ],
    },
    {
      key: "employmentStatus",
      label: "Employment Status",
      options: [
        { label: "No Employment Status", value: "__null__" },
        ...employmentStatuses.map((e) => ({ label: e.name, value: e.id })),
      ],
    },
    {
      key: "maritalStatus",
      label: "Marital Status",
      options: [
        { label: "No Marital Status", value: "__null__" },
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
    {
      key: "gender",
      label: "Gender",
      options: [
        { label: "No Gender", value: "__null__" },
        { label: "Not Specified", value: "Not Specified" },
        { label: "Male", value: "Male" },
        { label: "Female", value: "Female" },
      ],
    },
  ];
}

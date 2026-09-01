// Note on filters NOT declared here even though employeesService.js's
// fetchEmployees() supports them -- both are link-only, driven by Overview
// tile clicks rather than something an HR person would pick from a dropdown:
//   - departureDateFrom/departureDateTo: a free-form date RANGE, and
//     SearchFilterBar's filter panel only renders dropdown/asyncSelect
//     widgets today (its only date-range UI is the single hardcoded
//     enableDateRange pair, already used here for hire date). A second
//     manual date-range picker is a small SearchFilterBar enhancement of
//     its own, deferred rather than bundled into this pass.
//   - excludeEmploymentStatus: a narrow negation used by exactly one link
//     (Data Gaps' "Status Mismatch" sub-metric) -- not a filter an HR
//     person would naturally reach for on its own.
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
      // See docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md. Positive
      // filters only for v1 -- "no open case" is a negative-existence
      // query PostgREST's embed-filter syntax can't express as a simple
      // .eq(), flagged as a follow-up, not built here.
      key: "lifecycleCase",
      label: "Lifecycle Case",
      options: [
        { label: "Open Onboarding Case", value: "onboarding_open" },
        { label: "Open Offboarding Case", value: "offboarding_open" },
      ],
    },
    {
      key: "statusBucket",
      label: "Status Bucket",
      options: [
        { label: "Active (Active/Probation/On Leave/Sabbatical)", value: "active" },
        { label: "Terminated (Terminated/Resigned/Retired/Notice)", value: "terminated" },
        { label: "Inactive (Inactive/Suspended)", value: "inactive" },
      ],
    },
    {
      key: "manager",
      label: "Manager",
      options: [
        { label: "No Manager", value: "__null__" },
        { label: "Has Manager", value: "__notnull__" },
        ...managers.map((e) => ({ label: e.full_name, value: e.id })),
      ],
    },
    {
      key: "profile",
      label: "Profile Link",
      options: [
        { label: "No Profile Linked", value: "__null__" },
        { label: "Has Profile Linked", value: "__notnull__" },
      ],
    },
    {
      key: "confirmationStatus",
      label: "Confirmation Status",
      options: [
        { label: "Not Yet Confirmed", value: "not_confirmed" },
        { label: "Confirmation Due Soon (30 Days)", value: "due_soon" },
        { label: "Confirmation Overdue", value: "overdue" },
      ],
    },
    {
      key: "contractEndingSoon",
      label: "Contract Ending",
      options: [{ label: "Ending in 30 Days", value: "30" }],
    },
    {
      key: "ageBand",
      label: "Age",
      options: [
        { label: "Under 25", value: "< 25" },
        { label: "25-34", value: "25-34" },
        { label: "35-44", value: "35-44" },
        { label: "45-54", value: "45-54" },
        { label: "55+", value: "55+" },
        { label: "Unknown", value: "Unknown" },
      ],
    },
    {
      key: "tenureBand",
      label: "Tenure",
      options: [
        { label: "< 1 Year", value: "< 1 year" },
        { label: "1-3 Years", value: "1-3 years" },
        { label: "3-5 Years", value: "3-5 years" },
        { label: "5-10 Years", value: "5-10 years" },
        { label: "10+ Years", value: "10+ years" },
        { label: "Unknown", value: "Unknown" },
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

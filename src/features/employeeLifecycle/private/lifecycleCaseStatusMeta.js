// Single source of truth for the 3-value lifecycle_case_status enum and
// the case_type badge styling -- mirrors
// src/features/workspace/tasks/private/taskStatusMeta.js's own shape.
export const CASE_STATUSES = [
  { label: "Open", value: "OPEN" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export const CASE_STATUS_TYPE = {
  OPEN: "blue",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const CASE_TYPE_LABEL = {
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
};

// Imported by every insertion point that renders a case-type badge
// (CaseCard, the Employee Management table column, EmployeesList's default
// card view, EmployeeLifecycleCaseSummary) so the color can never drift
// between them.
export const CASE_TYPE_BADGE_TYPE = {
  ONBOARDING: "blue",
  OFFBOARDING: "yellow",
};

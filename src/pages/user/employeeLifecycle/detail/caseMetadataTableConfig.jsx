import { CASE_STATUSES } from "../../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";

/**
 * The one place this feature still uses the standard tableConfig.jsx/
 * DataSidebar/DataForm recipe -- editing a case's own top-level metadata,
 * separated from the checklist itself (which is NOT a DataForm, per
 * docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md). Mirrors
 * ProjectDetailLayout.jsx's own "small edit panel opened from the header,
 * separate from the tab content" pattern.
 *
 * `status` here is the "Manual status override" design -- a plain editable
 * select, RLS-gated to HR + superadmin (employee_lifecycle_cases' own
 * UPDATE policy), following the projects.status precedent.
 */
export function lifecycleCaseMetadataTableConfig({ caseType }) {
  const columns = [
    {
      key: "status",
      label: "Status",
      getValue: (c) => c.status,
      editable: true,
      editor: "select",
      options: CASE_STATUSES,
      isSearchable: false,
      required: true,
    },
  ];

  if (caseType === "OFFBOARDING") {
    columns.push(
      {
        key: "expected_last_day",
        label: "Expected Last Day",
        getValue: (c) => c.expected_last_day,
        editable: true,
        editor: "date",
      },
      {
        key: "employee_can_view",
        label: "Employee Can View This Case",
        getValue: (c) => c.employee_can_view,
        editable: true,
        editor: "select",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
        isSearchable: false,
      },
    );
  }

  columns.push({
    key: "closed_reason",
    label: "Closed Reason",
    getValue: (c) => c.closed_reason,
    editable: false,
    editor: "text",
    show: false,
  });

  return columns;
}

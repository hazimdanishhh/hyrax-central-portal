// A "Project" filter (like the workspace Documents page has) would be
// redundant here -- this tab is already scoped to one project. Attached By
// is the non-redundant dimension instead, useful once a project's library
// has documents from several different team members.
export function getProjectDocumentsFilterConfig({ workingMembers = [] }) {
  return [
    {
      key: "attachedBy",
      label: "Attached By",
      options: workingMembers.map((m) => ({
        label: m.employee?.full_name,
        value: m.employee_id,
      })),
    },
  ];
}

// Assignee, not Status -- status is already covered by this tab's own
// status-tabs strip (see ProjectTasksTab.jsx), so duplicating it here would
// just be a redundant control for the same field.
export function getProjectTasksFilterConfig({ workingMembers = [] }) {
  return [
    {
      key: "assignee",
      label: "Assignee",
      options: workingMembers.map((m) => ({
        label: m.employee?.full_name,
        value: m.employee_id,
      })),
    },
  ];
}

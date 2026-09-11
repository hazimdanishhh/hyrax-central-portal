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
    {
      // Computed due_date condition, not a raw column -- same shape as
      // getMyTasksFilterConfig's own dueStatus entry. Drives the
      // per-project Overview tab's Overdue/Due Soon/Completed Late
      // tiles' link_to.
      key: "dueStatus",
      label: "Due",
      options: [
        { label: "Overdue", value: "overdue" },
        { label: "Due Soon", value: "due_soon" },
        { label: "Completed Late", value: "completed_late" },
      ],
    },
  ];
}

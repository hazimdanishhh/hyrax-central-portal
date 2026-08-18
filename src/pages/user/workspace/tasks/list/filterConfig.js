import { TASK_STATUSES } from "../../../../../features/workspace/tasks/private/taskStatusMeta";

export function getMyTasksFilterConfig({ projects = [] } = {}) {
  return [
    {
      key: "status",
      label: "Status",
      options: TASK_STATUSES,
    },
    {
      key: "project",
      label: "Project",
      options: projects.map((p) => ({ label: p.name, value: p.id })),
    },
    {
      // Computed due_date condition, not a raw column -- see fetchMyTasks's
      // dueStatus handling in myTasksService.js. Drives both the OverviewCards
      // Overdue/Due Soon KPI cards and this dropdown/ActiveFiltersBar chip.
      key: "dueStatus",
      label: "Due",
      options: [
        { label: "Overdue", value: "overdue" },
        { label: "Due Soon", value: "due_soon" },
      ],
    },
  ];
}

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
  ];
}

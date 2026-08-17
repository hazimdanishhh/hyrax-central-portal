import { TASK_STATUSES } from "../../../../../features/workspace/tasks/private/taskStatusMeta";

export function getMyTasksFilterConfig() {
  return [
    {
      key: "status",
      label: "Status",
      options: TASK_STATUSES,
    },
  ];
}

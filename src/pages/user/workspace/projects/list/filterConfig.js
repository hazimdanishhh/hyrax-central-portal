import { PROJECT_STATUSES } from "../../../../../features/workspace/projects/private/projectStatusMeta";

export function getProjectsFilterConfig({ categories = [] }) {
  return [
    {
      key: "status",
      label: "Status",
      options: PROJECT_STATUSES,
    },
    {
      key: "category",
      label: "Category",
      options: categories.map((c) => ({ label: c.name, value: c.id })),
    },
    {
      // Computed target_end_date condition, not a raw column -- mirrors
      // getMyTasksFilterConfig's own dueStatus entry exactly. See
      // fetchProjects's dueStatus handling in projectsService.js. Drives
      // the project.deadline_approaching/project.overdue digest
      // notifications' link_to (?dueStatus=due_soon / ?dueStatus=overdue).
      key: "dueStatus",
      label: "Deadline",
      options: [
        { label: "Overdue", value: "overdue" },
        { label: "Due Soon", value: "due_soon" },
      ],
    },
  ];
}

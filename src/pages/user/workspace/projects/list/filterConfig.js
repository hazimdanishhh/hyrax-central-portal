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
  ];
}

export function getDocumentsFilterConfig({ projects = [] }) {
  return [
    {
      key: "project",
      label: "Project",
      options: projects.map((p) => ({ label: p.name, value: p.id })),
    },
  ];
}

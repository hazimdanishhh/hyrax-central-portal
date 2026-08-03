// Employee picker sourced from the manager's own direct reports
// (useSubordinatesPublic), never the company-wide roster -- same source the
// Team Attendance List page's filter already uses. No department picker
// (a manager's own scope).
export function getTeamAttendanceOverviewFilterConfig({ subordinates = [] }) {
  return [
    {
      key: "employee",
      label: "Employee",
      options: subordinates.map((e) => ({ label: e.full_name, value: e.id })),
    },
  ];
}

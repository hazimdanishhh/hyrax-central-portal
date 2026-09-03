export function getAttendanceOverviewFilterConfig({
  departments,
  employees,
  workLocations,
}) {
  return [
    {
      key: "department",
      label: "Department",
      options: (departments || []).map((d) => ({
        label: d.name,
        value: d.id,
      })),
    },
    {
      key: "workLocation",
      label: "Work Location",
      options: (workLocations || []).map((w) => ({
        label: w.name,
        value: w.id,
      })),
    },
    {
      key: "employee",
      label: "Employee",
      // Lets HR pull one employee's attendance summary for a period (e.g.
      // payroll prep) without a separate page -- see
      // get_attendance_dashboard_rpc.sql's p_employee_id.
      options: (employees || []).map((e) => ({
        label: e.full_name,
        value: e.id,
      })),
    },
  ];
}

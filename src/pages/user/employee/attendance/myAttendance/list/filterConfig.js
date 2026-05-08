export function getAttendanceActivitiesFilterConfig({
  employees,
  departments,
  attendanceTypes,
}) {
  return [
    {
      key: "employee",
      label: "Employee",
      options: employees.map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      key: "department",
      label: "Department",
      options: departments.map((e) => ({ label: e.name, value: e.id })),
    },
    {
      key: "attendanceType",
      label: "Attendance Type",
      options: attendanceTypes.map((i) => ({ label: i.name, value: i.id })),
    },
    {
      key: "approvedBy",
      label: "Approved By",
      options: employees.map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      key: "approvalStatus",
      label: "Approval Status",
      options: [
        { label: "Approved", value: "Approved" },
        { label: "Pending", value: "Pending" },
        { label: "Rejected", value: "Rejected" },
      ],
    },
  ];
}

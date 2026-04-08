export function getAttendanceActivitiesFilterConfig({ subordinates }) {
  return [
    {
      key: "approval_status",
      label: "Status",
      options: ["Pending", "Approved", "Rejected"],
    },
    {
      key: "subordinates",
      label: "Employee",
      options: subordinates.map((e) => e.full_name),
    },
  ];
}

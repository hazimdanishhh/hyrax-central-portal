export function getAttendanceActivitiesFilterConfig() {
  return [
    {
      key: "approval_status",
      label: "Status",
      options: ["Pending", "Approved", "Rejected"],
    },
  ];
}

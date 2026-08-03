// Same shape as HR's getAttendanceActivitiesFilterConfig, minus the
// "department"/"manager" pickers (scope is always "my direct reports").
// "employee" options come from the caller's direct-reports list
// (useSubordinatesPublic), never the company-wide employee roster --
// a manager should never see the full company in this dropdown.
export function getTeamAttendanceFilterConfig({ subordinates = [] }) {
  return [
    {
      key: "employee",
      label: "Employee",
      options: subordinates.map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      key: "hrFlag",
      label: "Status",
      options: [
        { label: "OK", value: "OK" },
        { label: "Approved", value: "Approved" },
        { label: "Pending App Approval", value: "Pending App Approval" },
        { label: "Missing App Check-Out", value: "Missing App Check-Out" },
        { label: "Incomplete Card Scans", value: "Incomplete Card Scans" },
        { label: "Absent", value: "Absent" },
        { label: "Weekend / Rest Day", value: "Weekend / Rest Day" },
      ],
    },
    {
      key: "workingDayOnly",
      label: "Working Days",
      options: [{ label: "Exclude Weekend / Rest Day", value: "true" }],
    },
    {
      key: "presentOnly",
      label: "Presence",
      options: [
        { label: "Present Only (Exclude Absent/Weekend)", value: "true" },
      ],
    },
    {
      key: "overtimeOnly",
      label: "Overtime",
      options: [{ label: "Overtime Only (>8h)", value: "true" }],
    },
    {
      key: "lateArrival",
      label: "Late Arrival",
      options: [{ label: "First In After 9:00 AM", value: "true" }],
    },
    {
      key: "earlyLeave",
      label: "Early Leave",
      options: [{ label: "Last Out Before 6:00 PM", value: "true" }],
    },
  ];
}

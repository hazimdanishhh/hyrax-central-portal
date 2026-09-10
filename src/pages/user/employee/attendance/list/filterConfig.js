// Trimmed version of HR's getAttendanceActivitiesFilterConfig -- no
// employee/department/manager pickers, since this page's scope is always
// "me". Status + the business-window toggles are still useful self-service
// slices ("show me my late arrivals", "my overtime days").
export function getMyAttendanceFilterConfig() {
  return [
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
      ],
    },
    {
      key: "workingDayOnly",
      label: "Working Days",
      options: [{ label: "Exclude Weekends", value: "true" }],
    },
    {
      // is_weekend is a calendar-only signal (true every Saturday/Sunday,
      // worked or not) -- see the HR filter config's own comment on this
      // same key for why it replaced the old "Weekend / Rest Day" hrFlag
      // option above.
      key: "weekendOnly",
      label: "Weekend",
      options: [{ label: "Weekend Only", value: "true" }],
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
      options: [{ label: "Overtime Only (After 6:00 PM)", value: "true" }],
    },
    {
      key: "lateArrival",
      label: "Late Arrival",
      options: [{ label: "First In After 9:00 AM", value: "true" }],
    },
    {
      key: "earlyLeave",
      label: "Early Leave",
      options: [{ label: "Last Out Before 5:00 PM", value: "true" }],
    },
  ];
}

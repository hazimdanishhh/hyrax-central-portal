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
      // Merged "Working Days Only"/"Weekend Only" into one filter -- see
      // the HR filter config's own comment on this same key.
      key: "dayType",
      label: "Day Type",
      options: [
        { label: "Working Days Only", value: "working" },
        { label: "Weekend Only", value: "weekend" },
      ],
    },
    {
      // See the HR filter config's own comment on this same key -- excludes
      // hr_flag = "Absent" and an unworked Public Holiday, not is_weekend
      // (a worked Saturday still correctly counts as present).
      key: "presentOnly",
      label: "Presence",
      options: [
        { label: "Present Only (Exclude Absent/Holiday)", value: "true" },
      ],
    },
    {
      key: "onLeave",
      label: "Leave",
      options: [{ label: "On Leave Only", value: "true" }],
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
    {
      key: "leaveAttendanceConflict",
      label: "Leave Conflict",
      options: [{ label: "Full-Day Leave But Attended", value: "true" }],
    },
    {
      key: "insufficientHalfDayHours",
      label: "Insufficient Half-Day Hours",
      options: [{ label: "Half-Day Leave, <4h Worked", value: "true" }],
    },
    {
      key: "leaveFractionError",
      label: "Leave Data Error",
      options: [{ label: "Leave Fraction Sum > 1 Day", value: "true" }],
    },
    {
      key: "publicHoliday",
      label: "Public Holiday",
      options: [{ label: "Public Holiday Only", value: "true" }],
    },
    {
      key: "workedOnHoliday",
      label: "Worked on Holiday",
      options: [{ label: "Worked on Holiday Only", value: "true" }],
    },
    {
      key: "workedOnWeekend",
      label: "Worked on Weekend",
      options: [{ label: "Worked on Weekend Only", value: "true" }],
    },
  ];
}

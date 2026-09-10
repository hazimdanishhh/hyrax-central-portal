// Filters actually verified against unified_daily_attendance's real columns
// (hr_unified_daily_attendance_view.sql) and against fetchUnifiedAttendance's
// filter switch (attendanceOverviewService.js). The previous version of this
// config (employee/department/attendanceType/approvedBy/approvalStatus) was
// modeled on the old per-activity attendance_activities table this page used
// to query -- attendanceType/approvalStatus filtered columns that don't
// exist on this view (a 400 the moment they were used), and approvedBy had
// no matching case in the filter switch at all (a silent no-op).
export function getAttendanceActivitiesFilterConfig({
  employees,
  departments,
  workLocations,
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
      key: "workLocation",
      label: "Work Location",
      options: (workLocations || []).map((w) => ({
        label: w.name,
        value: w.id,
      })),
    },
    {
      key: "manager",
      label: "Manager",
      options: employees.map((e) => ({ label: e.full_name, value: e.id })),
    },
    {
      key: "hrFlag",
      label: "Status",
      // The exact, exhaustive set of values unified_daily_attendance's
      // hr_flag CASE expression can produce -- hr_unified_daily_attendance_view.sql.
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
      // Merged "Working Days Only"/"Weekend Only" into one filter -- they
      // were two separate dropdown entries that were really just opposite
      // ends of the same is_weekend boolean (hr_unified_daily_attendance_view.sql).
      key: "dayType",
      label: "Day Type",
      options: [
        { label: "Working Days Only", value: "working" },
        { label: "Weekend Only", value: "weekend" },
      ],
    },
    {
      // "Present" excludes hr_flag = "Absent" and an unworked Public
      // Holiday -- NOT is_weekend, since an unworked weekend already reads
      // hr_flag = "Absent" (hr_flag no longer has a "Weekend / Rest Day"
      // value at all), so it's already covered by the Absent exclusion
      // alone. A worked Saturday still correctly counts as present.
      key: "presentOnly",
      label: "Presence",
      options: [{ label: "Present Only (Exclude Absent/Holiday)", value: "true" }],
    },
    {
      // hrFlag's fixed enum can't target "On Leave (AL)"/"On Leave (AL+MC)"
      // -- the real value carries a dynamic leave-type suffix. A boolean
      // toggle against is_on_leave (same pattern as presentOnly/overtimeOnly)
      // works regardless of which type(s) fired that day.
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
      // HR2000 leave/attendance conflict detection -- see
      // hr_unified_daily_attendance_view.sql's is_leave_attendance_conflict.
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
      // Public holidays integration -- hr_flag now carries a dynamic
      // "Public Holiday (<name>)" suffix (same reason onLeave above is a
      // boolean toggle, not a fixed hrFlag enum value): is_public_holiday
      // is the exact-match-safe column to filter on instead.
      key: "publicHoliday",
      label: "Public Holiday",
      options: [{ label: "Public Holiday Only", value: "true" }],
    },
    {
      // The reconciliation pull-list: every day an employee actually
      // attended on a day nobody was expected to work. Distinct from
      // publicHoliday above, which includes holidays nobody worked at all.
      key: "workedOnHoliday",
      label: "Worked on Holiday",
      options: [{ label: "Worked on Holiday Only", value: "true" }],
    },
    {
      // Mirrors workedOnHoliday above exactly -- the same reconciliation
      // pull-list, for weekends instead of public holidays.
      key: "workedOnWeekend",
      label: "Worked on Weekend",
      options: [{ label: "Worked on Weekend Only", value: "true" }],
    },
  ];
}

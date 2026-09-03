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
      options: [{ label: "Present Only (Exclude Absent/Weekend)", value: "true" }],
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

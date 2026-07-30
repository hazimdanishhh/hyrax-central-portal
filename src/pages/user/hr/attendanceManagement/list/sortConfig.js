// Sort options verified against unified_daily_attendance's real columns
// (hr_unified_daily_attendance_view.sql). The previous version
// (employee_id/attendance_type_id/clocked_in_at/clocked_out_at/approved_by/
// approved_at/approval_status) referenced columns from the old per-activity
// attendance_activities table this page used to query -- none of those
// columns exist on this view. Since every page is now exactly one calendar
// day (see useAttendanceDailyList), sort order here is purely cosmetic
// ordering within that day's roster, not a pagination-integrity concern.
export const getAttendanceActivitiesSortConfig = () => [
  {
    label: "Employee Name",
    value: "full_name",
  },
  {
    label: "Department",
    value: "department_name",
  },
  {
    label: "Hours Worked",
    value: "hours_worked",
  },
  {
    label: "Status",
    value: "hr_flag",
  },
  {
    label: "First In",
    value: "first_in",
  },
  {
    label: "Last Out",
    value: "last_out",
  },
];

// Sort options verified against unified_daily_attendance's real columns
// (hr_unified_daily_attendance_view.sql). The previous version
// (employee_id/attendance_type_id/clocked_in_at/clocked_out_at/approved_by/
// approved_at/approval_status) referenced columns from the old per-activity
// attendance_activities table this page used to query -- none of those
// columns exist on this view.
//
// In day mode (see useAttendanceDailyList) every page is exactly one
// calendar day, so sort order is purely cosmetic ordering within that day's
// roster. In search mode (fetchUnifiedAttendanceSearch, results spanning
// many dates), "Date" is meaningful again -- it's this list's default sort.
export const getAttendanceActivitiesSortConfig = () => [
  {
    label: "Date",
    value: "work_date",
  },
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
    // day_state, not hr_flag. Both sort alphabetically rather than by
    // severity, but day_state at least groups sensibly when it does --
    // 'absent' first, the weekend/holiday family together, the leave_* family
    // together -- whereas hr_flag's alphabetical order interleaved
    // 'Approved', 'Absent' and 'Incomplete Card Scans' meaninglessly.
    label: "Day Type",
    value: "day_state",
  },
  {
    // Sorting by data quality is genuinely useful now that it is its own
    // column: it brings every record with a defect to the top regardless of
    // what kind of day it was or whether it was approved. Under hr_flag this
    // was impossible -- the quality values were only reachable when no
    // approval value had already claimed the field.
    label: "Data Quality",
    value: "evidence_quality",
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

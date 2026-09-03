// tableConfig.jsx
//
// Read-only display columns for the List page's Table view, matching
// unified_daily_attendance's real shape (hr_unified_daily_attendance_view.sql)
// -- a computed reconciliation view, not a writable table, so every column
// here is editable: false. This used to be modeled on the raw
// attendance_activities table (employee_id/attendance_type_id/photo_url/
// notes), which rendered blank cells against these daily-summary rows.
// The "Add Attendance" create form uses a separate config instead --
// createAttendanceActivityFormConfig.jsx -- since creating still inserts
// into the raw attendance_activities table, a different shape entirely.
//
// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type

export const attendanceDailySummaryTableConfig = () => [
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "work_date",
    label: "Date",
    getValue: (activity) => activity.work_date,
    editable: false,
    editor: "text",
  },
  {
    key: "full_name",
    label: "Employee",
    getValue: (activity) => activity.full_name,
    editable: false,
    editor: "text",
  },
  {
    key: "department_name",
    label: "Department",
    getValue: (activity) => activity.department_name,
    editable: false,
    editor: "text",
  },
  {
    key: "position",
    label: "Position",
    getValue: (activity) => activity.position,
    editable: false,
    editor: "text",
  },
  {
    key: "first_in",
    label: "First In",
    getValue: (activity) => activity.first_in,
    editable: false,
    editor: "text",
  },
  {
    key: "last_out",
    label: "Last Out",
    getValue: (activity) => activity.last_out,
    editable: false,
    editor: "text",
  },
  {
    key: "hours_worked",
    label: "Hours Worked",
    getValue: (activity) => activity.hours_worked,
    editable: false,
    editor: "text",
  },
  {
    key: "hr_flag",
    label: "Status",
    getValue: (activity) => activity.hr_flag,
    editable: false,
    editor: "text",
  },
  {
    key: "daily_activities",
    label: "Activities",
    getValue: (activity) => activity.daily_activities,
    editable: false,
    editor: "text",
  },
  {
    // HR2000 leave ledger integration -- surfaces leave_type_codes +
    // leave_day_fraction (the 0.5/1.0-day indicator) independently of
    // hr_flag, since a half-day-leave + half-day-worked record still reads
    // "OK" under hr_flag but must not lose the leave context.
    key: "leave",
    label: "Leave",
    getValue: (activity) =>
      activity.is_on_leave
        ? `${activity.leave_type_codes} (${activity.leave_day_fraction}d)`
        : "—",
    editable: false,
    editor: "text",
  },
  {
    key: "total_hw_scans",
    label: "Scanner Scans",
    getValue: (activity) => activity.total_hw_scans,
    editable: false,
    editor: "text",
  },
];

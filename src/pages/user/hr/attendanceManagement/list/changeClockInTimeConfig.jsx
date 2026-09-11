// employeesTableConfig.jsx

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const attendanceActivitiesChangeClockInTimeConfig = () => [
  {
    key: "id",
    label: "ID",
    getValue: "activity_id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "clocked_in_at",
    label: "Clock In Time",
    getValue: (activity) => activity.clocked_in_at,
    editable: true,
    editor: "time",
    // Keeps the same calendar date as the activity itself -- only the
    // time-of-day is ever meant to change here. work_date already exists
    // on every row this form is opened against (attendance_activity_audit).
    getReferenceDate: (activity) => activity.work_date,
    required: true,
    // rowData.check_out_time -- not one of this form's own columns (Clock
    // In and Clock Out are two separate single-field forms) -- see
    // DataForm.jsx's validate wiring.
    validate: (value, { rowData }) =>
      !value ||
      !rowData.check_out_time ||
      new Date(value) < new Date(rowData.check_out_time) ||
      "Clock In must be before Clock Out",
  },
];

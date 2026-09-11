// employeesTableConfig.jsx

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const attendanceActivitiesChangeClockOutTimeConfig = () => [
  {
    key: "id",
    label: "ID",
    getValue: "activity_id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "clocked_out_at",
    label: "Clock Out Time",
    getValue: (activity) => activity.clocked_out_at,
    editable: true,
    editor: "time",
    // Keeps the same calendar date as the activity itself -- only the
    // time-of-day is ever meant to change here (also the anchor date used
    // when setting a clock-out for the first time, since clocked_out_at
    // itself may still be null).
    getReferenceDate: (activity) => activity.work_date,
    // rowData.check_in_time -- not one of this form's own columns (Clock
    // In and Clock Out are two separate single-field forms) -- see
    // DataForm.jsx's validate wiring.
    validate: (value, { rowData }) =>
      !value ||
      !rowData.check_in_time ||
      new Date(value) > new Date(rowData.check_in_time) ||
      "Clock Out must be after Clock In",
  },
];

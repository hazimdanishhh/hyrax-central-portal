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
    label: "Clock Out Date",
    getValue: (activity) => activity.clocked_out_at,
    editable: true,
    editor: "dateTime",
  },
];

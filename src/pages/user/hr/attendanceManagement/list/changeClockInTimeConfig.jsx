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
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "clocked_in_at",
    label: "Clock In Date",
    getValue: (activity) => activity.clocked_in_at,
    editable: true,
    editor: "dateTime",
    required: true,
  },
];

// createAttendanceActivityFormConfig.jsx
//
// Column config for the "Add Attendance" create-only form
// (DataSidebar/DataForm in AttendanceManagement.jsx, rendered only when
// selectedRow has no id -- isEditing={!selectedRow?.id}). Creating still
// inserts a raw row into attendance_activities via createAttendanceActivity,
// so this config is modeled on that table's real columns -- deliberately
// NOT the same config as the List/Table view (tableConfig.jsx), which
// displays unified_daily_attendance's read-only daily-summary rows instead.
// These used to be the same config (attendanceActivitiesTableConfig), which
// is why the Table view rendered blank Employee/Attendance-Type/Photo
// columns against daily-summary rows that don't have those fields.
//
// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const createAttendanceActivityFormConfig = ({
  employees,
  attendanceTypes,
}) => [
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "employee_id",
    label: "Employee",
    getValue: (activity) => activity.employee_id,
    displayValue: (activity) => activity.employee?.full_name,
    editable: true,
    editor: "select",
    options: employees.map((e) => ({
      label: e.full_name,
      value: e.id,
    })),
    required: true,
  },
  {
    key: "attendance_type_id",
    label: "Attendance Type",
    getValue: (activity) => activity.attendance_type_id,
    displayValue: (activity) => activity.attendance_type?.name,
    editable: true,
    editor: "select",
    options: attendanceTypes.map((n) => ({
      label: n.name,
      value: n.id,
    })),
    isSearchable: false,
    required: true,
  },
  {
    key: "photo_url",
    label: "Attendance Photo",
    getValue: (activity) => activity.photo_url,
    editable: true,
    editor: "image",
  },
  {
    key: "notes",
    label: "Notes",
    getValue: (activity) => activity.notes,
    editable: true,
    editor: "text",
  },
];

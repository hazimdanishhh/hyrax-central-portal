// employeesTableConfig.jsx

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const attendanceActivityTableConfig = ({
  employees,
  attendanceTypes,
}) => [
  {
    key: "id",
    label: "ID",
    getValue: "activity_id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "employee_id",
    label: "Employee",
    getValue: (activity) => activity.employee_uuid,
    displayValue: (activity) => activity.full_name,
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
    getValue: (activity) => activity.attendance_type,
    displayValue: (activity) => activity.attendance_type,
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
    // required: true,
  },
  {
    key: "notes",
    label: "Notes",
    getValue: (activity) => activity.notes,
    editable: true,
    editor: "text",
  },
  //   {
  //     key: "location",
  //     label: "Location",
  //     getValue: (activity) => activity.location,
  //     editable: true,
  //     editor: "text",
  //   },
  // {
  //   key: "clocked_in_at",
  //   label: "Clock In Date",
  //   getValue: (activity) => activity.clocked_in_at,
  //   editable: true,
  //   editor: "dateTime",
  //   required: true,
  // },
  // {
  //   key: "clocked_out_at",
  //   label: "Clock Out Date",
  //   getValue: (activity) => activity.clocked_out_at,
  //   editable: true,
  //   editor: "dateTime",
  // },
  //   {
  //     key: "approved_by",
  //     label: "Approver",
  //     getValue: (activity) => activity.approved_by,
  //     displayValue: (activity) => activity.approved_by?.full_name,
  //     editable: true,
  //     editor: "select",
  //     options: employees.map((e) => ({
  //       label: e.full_name,
  //       value: e.id,
  //     })),
  //   },
  //   {
  //     key: "approved_at",
  //     label: "Approval Date",
  //     getValue: (activity) => activity.approved_at,
  //     editable: true,
  //     editor: "dateTime",
  //   },
  //   {
  //     key: "rejection_reason",
  //     label: "Rejection Reason",
  //     getValue: (activity) => activity.rejection_reason,
  //     editable: true,
  //     editor: "text",
  //   },
  //   {
  //     key: "approval_status",
  //     label: "Approval Status",
  //     getValue: (activity) => activity.approval_status,
  //     editable: true,
  //     editor: "select",
  //     options: [{ label: "Pending", value: "Pending" }],
  //     isSearchable: false,
  //     required: true,
  //   },
];

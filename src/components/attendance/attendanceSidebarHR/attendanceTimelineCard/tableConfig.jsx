// employeesTableConfig.jsx

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

import { evidenceRequired } from "@/functions/attendanceEvidenceRules";

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
    // attendance_activity_audit's own `attendance_type` column is already
    // the joined display NAME (a plain string, e.g. "Site Visit") -- not a
    // nested {name} relation object, so no `.name` here. getValue reads the
    // real FK id (now selected by the view specifically for this form; it
    // didn't exist on this view at all before), which is what lets the
    // select below actually preselect the activity's current type.
    getValue: (activity) => activity.attendance_type_id,
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
    // ASYMMETRIC BY DESIGN, and the asymmetry is not obvious from here.
    // `allowReplace` is deliberately unset: per ImageUploadEditor's own
    // comment, an attendance photo is meant to stay as originally captured,
    // so once one exists the editor renders no "Change Photo" button.
    //
    // But it DOES still render "Take Photo" when the activity has no photo
    // yet (the editor gates on `!preview || allowReplace`), so this field is
    // add-only rather than read-only. That add path is what produced the one
    // corrupted row in the database -- see
    // src/services/storage/applyAttendancePhotoUpload.js, which
    // AttendanceTimelineCard's handleRequestSave now calls to make it work.
    key: "photo_url",
    label: "Attendance Photo",
    getValue: (activity) => activity.photo_url,
    editable: true,
    editor: "image",
    required: evidenceRequired(attendanceTypes, "requires_photo"),
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

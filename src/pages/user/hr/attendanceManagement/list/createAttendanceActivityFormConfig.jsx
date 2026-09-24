// createAttendanceActivityFormConfig.jsx
//
// Column config for the "Add Single Activity" create-only form
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
// SUPERSEDED 2026-09-24, kept as a file rather than deleted. This form wrote
// straight to attendance_activities, which is exactly why it existed alongside
// the Backfill wizard: it was the only "add" path that could attach a photo,
// which the wizard had no concept of. Both of those are now false --
// AttendanceSubmissionForm (create_attendance_submission) captures a photo
// too, and additionally goes through the RPC's own authorization, overlap
// guard and server-derived provenance, none of which a direct table insert
// ever got. AttendanceManagement.jsx's "Add Activity" button that opened this
// form is commented out, not deleted, for the same one-line-revert reason
// every other surface in this pass was swapped rather than removed.
//
// This file, and createAttendanceActivity/updateAttendanceActivity in
// useAttendanceActivityMutations.js, are unmodified and still reachable
// directly at /app/hr/attendance/list/new if ever needed.
//
// THE BUG THIS CONFIG USED TO HAVE, now fixed: it had no date or time fields
// at all. A row created through it therefore fell back to
// clocked_in_at DEFAULT now() with clocked_out_at NULL -- so "adding
// attendance" for a past day silently created a still-OPEN session dated
// today. That open row then:
//   - gets force-closed to now() by auto_clock_out()'s 17:00/23:59 sweeps,
//   - reads as hr_flag 'Missing App Check-Out' until it does, and
//   - breaks AttendanceProvider's .maybeSingle() "am I clocked in" query if
//     that employee is also genuinely clocked in (two open rows -> PGRST116
//     -> the nav widget shows "not clocked in" -> the employee clocks in
//     again -> a third open row).
// work_date + both times are now required, and the two time columns anchor
// to work_date through getReferenceDate.
//
// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

import { evidenceRequired } from "@/functions/attendanceEvidenceRules";

export const createAttendanceActivityFormConfig = ({
  employees,
  attendanceTypes,
  adjustmentReasons = [],
}) => {
  // Is the type currently chosen IN THIS FORM a whole-day one? Read live from
  // the form values rather than from a prop, so the time fields react to the
  // type select sitting right above them.
  const isFullDaySelected = (formValues) =>
    attendanceTypes.find(
      (t) => String(t.id) === String(formValues?.attendance_type_id),
    )?.is_full_day === true;

  return [
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
    key: "work_date",
    label: "Work Date",
    getValue: (activity) => activity.work_date,
    editable: true,
    editor: "date",
    required: true,
    // The two time fields re-anchor to this date only when they are next
    // changed, so a date edit after the times were set would silently leave
    // them on the old day. Clearing forces them to be re-entered.
    clears: ["clocked_in_at", "clocked_out_at"],
  },
  {
    // getReferenceDate re-attaches the chosen Work Date to the entered
    // time-of-day, in MYT -- the same mechanism the Edit Clock In/Out
    // sub-forms use (changeClockInTimeConfig.jsx). Without it, TimeEditor
    // would fall back to the field's own (empty) value and produce a
    // timestamp anchored to today.
    key: "clocked_in_at",
    label: "Clock In Time",
    getValue: (activity) => activity.clocked_in_at,
    // formValues, not just rowData: on CREATE rowData is {} and the date being
    // anchored to is the sibling Work Date field the user is filling in right
    // now. Reading rowData alone returned undefined, which made
    // combineMYTDateAndTime short-circuit to null and left this required field
    // impossible to satisfy -- the form could never be submitted.
    getReferenceDate: (activity, formValues) =>
      formValues?.work_date || activity?.work_date,
    editable: true,
    editor: "time",
    // Hidden for a whole-day type -- a business trip has no clock times to
    // give, and they are derived server-side from the day shape. `required`
    // can't be a function, but a hidden field's rules unmount with its
    // Controller, so this doesn't block submit; DataForm also strips
    // function-hidden fields from the payload.
    show: (formValues) => !isFullDaySelected(formValues),
    required: true,
    validate: (value, { formValues }) => {
      if (!value || !formValues?.clocked_out_at) return true;
      return (
        new Date(value) < new Date(formValues.clocked_out_at) ||
        "Clock In Time must be before Clock Out Time"
      );
    },
  },
  {
    // Required, not optional. See the open-session failure chain in this
    // file's header comment -- a null clocked_out_at is the single most
    // damaging value this form can write.
    key: "clocked_out_at",
    label: "Clock Out Time",
    getValue: (activity) => activity.clocked_out_at,
    getReferenceDate: (activity, formValues) =>
      formValues?.work_date || activity?.work_date,
    editable: true,
    editor: "time",
    show: (formValues) => !isFullDaySelected(formValues),
    required: true,
    validate: (value, { formValues }) => {
      if (!value || !formValues?.clocked_in_at) return true;
      return (
        new Date(value) > new Date(formValues.clocked_in_at) ||
        "Clock Out Time must be after Clock In Time"
      );
    },
  },
  {
    key: "attendance_type_id",
    label: "Attendance Type",
    getValue: (activity) => activity.attendance_type_id,
    displayValue: (activity) => activity.attendance_type?.name,
    editable: true,
    editor: "select",
    // Unfiltered by is_self_selectable, unlike the live clock-in form: this
    // is a manual-entry path, so Office/Blending Plant are exactly the
    // values a scanner-failure day needs.
    options: attendanceTypes.map((n) => ({
      label: n.name,
      value: n.id,
    })),
    isSearchable: false,
    required: true,
  },
  {
    key: "adjustment_reason_id",
    label: "Reason",
    getValue: (activity) => activity.adjustment_reason_id,
    editable: true,
    editor: "select",
    options: adjustmentReasons.map((r) => ({
      label: r.label,
      value: r.id,
    })),
    isSearchable: false,
    required: true,
  },
  {
    // Required-ness comes from the chosen attendance type
    // (attendance_types.requires_photo), not from this file -- see
    // src/functions/attendanceEvidenceRules.js. Every surface that creates an
    // activity now asks the same question of the same column, so the rule
    // cannot drift between forms the way it had.
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
    editor: "textarea",
    required: evidenceRequired(attendanceTypes, "requires_notes"),
  },
  ];
};

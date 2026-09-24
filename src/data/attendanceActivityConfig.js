import { evidenceRequired } from "@/functions/attendanceEvidenceRules";

/**
 * Columns for the EMPLOYEE'S LIVE CLOCK-IN sidebar (ClockinMini in the nav,
 * TodayAttendanceCard on the dashboard -- both via useClockInOutAction).
 *
 * `selectedTypeId` used to be a parameter here, and no caller ever passed it,
 * so `selectedType?.requires_location` silently evaluated to undefined and the
 * per-type rule never worked. It is gone: requirements are now expressed as
 * predicates over the form's live values (see attendanceEvidenceRules.js),
 * which is the only way a column config built OUTSIDE the form can depend on a
 * field chosen INSIDE it.
 */
export function attendanceActivityConfig({ attendanceTypes = [] }) {
  return [
    {
      key: "attendance_type_id",
      label: "Attendance Type",
      editable: true,
      editor: "select",
      // LIVE clock-in only shows self-selectable types. Office and Blending
      // Plant are scanner-only by policy (see
      // docs/hr/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md: you are either badged
      // in at a company site or clocked in remotely through the app, never
      // both for the same moment) -- they exist as rows purely so a
      // failed-scanner day can be reconciled afterwards through the backfill
      // form, which deliberately does NOT apply this filter.
      //
      // Filtered HERE rather than in useAttendanceTypes.js / the metadata
      // service, because those also feed HR's timeline Edit form, which must
      // keep the full list for exactly that reconciliation case.
      //
      // `!== false` rather than `=== true`: tolerates a row created before the
      // is_self_selectable column existed, where the value could be undefined
      // in a cached response.
      //
      // Full-day types (Overseas Trip, Local Trip) are also excluded here:
      // both RPCs derive their fixed 08:30-shift-end times server-side, but a
      // live "clock in now" button has no such handling and would record
      // whatever moment the button was pressed as if it were a whole day.
      // They stay reachable through Add Activities (AttendanceSubmissionForm),
      // which already has full is_full_day handling.
      options: attendanceTypes
        .filter((a) => a.is_self_selectable !== false && !a.is_full_day)
        .map((a) => ({
          label: a.name,
          value: a.id,
        })),
      required: true,
    },
    {
      // UNCOMMENTED 2026-09-24. This field existed but was disabled, which
      // made a remote clock-in unverifiable by design: no photo, no location,
      // no device -- a button press. ImageUploadEditor's camera wiring
      // (capture="user") has been working the whole time and was simply
      // unreachable from any employee surface.
      //
      // Shown always, required only when the chosen type says so. Every type
      // currently ships requires_photo = false, so this renders as an optional
      // "Take Photo" button and nothing changes until HR turns a type on.
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
      editable: true,
      editor: "text",
      required: evidenceRequired(attendanceTypes, "requires_notes"),
      show: true,
    },
    // `location` stays commented out, deliberately and for now.
    // attendance_types.requires_location exists and is dead data until there
    // is something real to put in the column. A free-text box the employee
    // types into is not evidence of where they were; device geolocation is,
    // and it needs a permission prompt, a denial fallback, an accuracy
    // threshold and a privacy decision. Scoped as its own pass rather than
    // bolted onto this one.
    // {
    //   key: "location",
    //   label: "Location",
    //   editable: true,
    //   editor: "text",
    // },
  ];
}

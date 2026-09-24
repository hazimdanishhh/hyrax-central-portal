// Column config for the two halves of an attendance submission.
//
// key = the field on the row/state object
// label = UI name
// editor = which editor renders it
// required = boolean, or a predicate over the current values
//
// Same shape the rest of the app's configs use, so the fields are declared in
// one readable list rather than buried in JSX -- and so changing the order or
// adding a field is an edit here, not a component rewrite.

import {
  DAY_SHAPES,
  defaultTimesForShape,
} from "../attendanceBackfillWizard/backfillWizardUtils";
import { HALF_DAY_HOURS, spanHours } from "./submissionUtils";

/**
 * THE HEADER FIELDS -- everything that is true of the WHOLE submission.
 *
 * Order is deliberate and is the point of the consolidation:
 *
 *   employee -> attendance type -> dates -> reason -> photo -> notes
 *
 * Attendance type sits SECOND because it decides the shape of everything
 * below it: whether times are asked for at all (is_full_day), and whether a
 * photo or a note is mandatory (requires_photo / requires_notes). Asking for
 * it last -- as HR's existing Add Activity form does -- means the form cannot
 * adapt until the user has already filled in the parts the type governs.
 */
export function submissionHeaderConfig({
  // Already shaped as [{ label, value }] -- the caller decides the mapping,
  // because the callers do not agree on what they have to map FROM. HR and
  // Team Attendance already hand over pre-built {label, value} pairs (their
  // own employee/subordinate lists); My Attendance has none at all, since its
  // employee is locked. Mapping raw employee rows again in here, on top of an
  // already-mapped list, was the exact bug that shipped: every option came out
  // as {label: undefined, value: undefined} -- a dropdown with the right
  // COUNT of rows and none of their text, which is what made it look "empty"
  // rather than broken.
  employeeOptions = [],
  attendanceTypes = [],
  adjustmentReasons = [],
  lockedEmployee = false,
}) {
  return [
    {
      key: "employeeId",
      label: "Employee",
      editor: "select",
      // Locked when the surface already knows who: My Attendance is always
      // the signed-in employee, and the day sidebar is always the row it was
      // opened from. The RPC re-derives the caller's rights regardless, so
      // this is an affordance, not a control.
      readOnly: lockedEmployee,
      required: true,
      options: employeeOptions,
      placeholder: "Select employee",
    },
    {
      key: "attendanceTypeId",
      label: "Attendance Type",
      editor: "select",
      required: true,
      options: attendanceTypes.map((t) => ({ label: t.name, value: t.id })),
      placeholder: "Select type",
      // Everything below reacts to this, so the form re-derives times and
      // evidence requirements whenever it changes.
      governs: ["days", "photo", "notes"],
    },
    {
      key: "adjustmentReasonId",
      label: "Reason",
      editor: "select",
      required: true,
      options: adjustmentReasons.map((r) => ({ label: r.label, value: r.id })),
      placeholder: "Select reason",
      // Unchanged from the existing forms, per the brief. The reason's own
      // requires_notes still applies on top of the type's.
    },
    {
      key: "photo",
      label: "Attendance Photo",
      editor: "image",
      // ONE upload for the whole submission, referenced by every created row.
      // Required only when the chosen type says so.
      required: (values, { selectedType }) => Boolean(selectedType?.requires_photo),
    },
    {
      key: "notes",
      label: "Notes",
      editor: "textarea",
      // Either the type or the reason can demand a note, and both are
      // enforced again server-side.
      required: (values, { selectedType, selectedReason }) =>
        Boolean(selectedType?.requires_notes || selectedReason?.requires_notes),
    },
  ];
}

/**
 * THE PER-DATE GRID
 *
 * Every row shares the header's type, reason, photo and note; only the shape
 * and the two times are its own. That split is the whole feature: a four-day
 * business trip is one act with one piece of evidence, not four unrelated
 * entries that happen to look alike.
 *
 * There is deliberately no column config for these rows. The grid reuses
 * AttendanceBackfillWizard's own row markup and classes verbatim
 * (backfillDateRow / backfillDateLabel / backfillShapeSelect /
 * backfillDateTimes), so the two surfaces look and behave identically and a
 * later restyle of the wizard reaches this too. A parallel config describing
 * the same three fields would be a second source of truth for a layout that
 * already exists.
 *
 * The rules those rows obey do live here -- buildDayRow and validateDays below.
 */

/**
 * Build one grid row for a date.
 *
 * Times are SEEDED from the shape and stay editable -- and the shape still
 * constrains them afterwards (see validateDays). Seeding on every shape change
 * is what makes switching AM -> PM read as picking a different half rather
 * than leaving stale times behind.
 */
export function buildDayRow(workDate, shape, shiftEndTime) {
  const { clockIn, clockOut } = defaultTimesForShape(shape, shiftEndTime);
  return { workDate, selected: true, dayShape: shape, clockIn, clockOut };
}

/**
 * Per-row problems, keyed by date, so each row can show its own message
 * inline instead of one combined error at the bottom that makes you hunt for
 * which date it means.
 */
export function validateDays(days, { isFullDay }) {
  const problems = {};
  if (isFullDay) return problems;

  for (const day of days) {
    if (!day.selected) continue;

    const hours = spanHours(day.clockIn, day.clockOut);

    if (hours === null) {
      problems[day.workDate] = "Enter both times.";
      continue;
    }
    if (hours <= 0) {
      problems[day.workDate] = "Clock out must be after clock in.";
      continue;
    }
    // Half days may fall SHORT -- a half day that ran three hours is a real
    // thing that happened, and is exactly what the reconciliation flags exist
    // to surface. Only over-running is an error, because those hours are what
    // payroll reads.
    if (
      (day.dayShape === "am_half" || day.dayShape === "pm_half") &&
      hours > HALF_DAY_HOURS
    ) {
      problems[day.workDate] =
        `Half day cannot exceed ${HALF_DAY_HOURS}h (this is ${hours.toFixed(2)}h).`;
    }
  }

  return problems;
}

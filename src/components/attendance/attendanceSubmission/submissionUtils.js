// Time arithmetic and whole-submission validation.
//
// Kept separate from submissionTableConfig.jsx so the configs stay declarative
// and the rules stay testable on their own.

import { todayDateString } from "../attendanceBackfillWizard/backfillWizardUtils";

/** Minutes since midnight for an "HH:MM" string, or null. */
export function toMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Span in hours between two "HH:MM" strings, or null if either is unusable. */
export function spanHours(clockIn, clockOut) {
  const a = toMinutes(clockIn);
  const b = toMinutes(clockOut);
  if (a === null || b === null) return null;
  return (b - a) / 60;
}

// Four hours. 08:30-12:30 (AM) and 13:00-17:00 (PM) are both exactly that,
// and 4h is also the threshold hr_unified_daily_attendance_view.sql's
// is_insufficient_half_day_hours measures a half-day leave's working half
// against -- so the form and the flag agree by construction rather than by
// coincidence.
//
// Restated server-side in create_attendance_submission_rpc.sql. A form is an
// affordance, not a control: a row claiming a half day while carrying a full
// day's hours would feed payroll the hours.
export const HALF_DAY_HOURS = 4;

/**
 * Everything that must be true before the submission can be sent.
 *
 * Returns human-readable problems -- empty means valid. A list rather than a
 * single message, so every outstanding item shows at once instead of being
 * revealed one at a time.
 */
export function validateSubmission({
  employeeId,
  attendanceTypeId,
  adjustmentReasonId,
  days,
  notes,
  photo,
  selectedType,
  selectedReason,
  dayProblems,
  reasonRequired,
}) {
  const problems = [];
  const selectedDays = (days || []).filter((d) => d.selected);

  if (!employeeId) problems.push("Choose an employee.");
  if (!attendanceTypeId) problems.push("Choose an attendance type.");
  if (reasonRequired && !adjustmentReasonId) problems.push("Choose a reason.");
  if (selectedDays.length === 0) problems.push("Select at least one date.");

  // Scanner-only types (Office, Blending Plant) exist purely to reconcile a
  // failed-scanner day, never to pre-declare one. Enforced again server-side
  // in create_attendance_submission_rpc.sql.
  if (selectedType?.is_self_selectable === false) {
    const todayStr = todayDateString();
    if (selectedDays.some((d) => d.workDate > todayStr)) {
      problems.push(
        `${selectedType.name} is scanner-only and can only be recorded for today or earlier, not future dates.`,
      );
    }
  }

  // Matches the RPC's own cap. Enforced here too so a 200-day range fails
  // before an upload rather than after it.
  if (selectedDays.length > 62) {
    problems.push(
      `A single submission cannot span more than 62 days (this is ${selectedDays.length}).`,
    );
  }

  // Evidence requirements come from the attendance TYPE, and are enforced
  // again in the RPC -- see src/functions/attendanceEvidenceRules.js for why
  // the table, not the form, is the source of truth.
  if (selectedType?.requires_photo && !photo) {
    problems.push(`${selectedType.name} requires a photo.`);
  }
  if (selectedType?.requires_notes && !notes?.trim()) {
    problems.push(`${selectedType.name} requires notes.`);
  }
  // The reason's requirement is separate from the type's and both apply.
  if (selectedReason?.requires_notes && !notes?.trim()) {
    problems.push(`"${selectedReason.label}" requires a written explanation.`);
  }

  const badDates = Object.keys(dayProblems || {});
  if (badDates.length > 0) {
    problems.push(
      `Fix the times on ${badDates.length} date${badDates.length === 1 ? "" : "s"} below.`,
    );
  }

  return problems;
}

/**
 * Shape the grid into the RPC's `p_days` payload.
 *
 * Only selected rows. Times are omitted for a whole-day type -- the server
 * derives those from the employee's work location, and sending times it will
 * ignore invites someone later to "fix" the discrepancy.
 */
export function toSubmissionDays(days, { isFullDay }) {
  return (days || [])
    .filter((d) => d.selected)
    .map((d) => ({
      work_date: d.workDate,
      day_shape: isFullDay ? "full" : d.dayShape,
      ...(isFullDay
        ? {}
        : { clock_in_time: d.clockIn, clock_out_time: d.clockOut }),
    }));
}

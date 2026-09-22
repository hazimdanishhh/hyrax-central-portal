// Day-grain counterpart to payrollExport/filterConfig.js's
// getRowReconciliationFlags (which reads period-level counts). Reads the
// acknowledgement-aware columns hr_unified_daily_attendance_view.sql
// computes directly on unified_daily_attendance (is_unacknowledged_absent,
// is_unacknowledged_insufficient_half_day, needs_reconciliation) plus the
// two pre-existing raw flags that are never acknowledgeable
// (is_leave_attendance_conflict, has_leave_fraction_error) -- so this list
// and the view's own needs_reconciliation boolean can never disagree.
export function getAttendanceReconciliationFlags(record) {
  const flags = [];

  if (record.is_unacknowledged_absent) {
    flags.push("Absent - not yet reconciled");
  }
  if (record.is_leave_attendance_conflict) {
    flags.push("Leave/Attendance Conflict");
  }
  if (record.is_unacknowledged_insufficient_half_day) {
    flags.push("Insufficient Half-Day Hours");
  }
  if (record.has_leave_fraction_error) {
    flags.push("Leave Data Error");
  }

  return flags;
}

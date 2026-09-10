// components/attendance/attendanceAnomalyBadges/AttendanceAnomalyBadges.jsx

import StatusBox from "../../status/statusBox/StatusBox";

/**
 * Shared "does this day need a second look" badge cluster -- Overtime /
 * Early Leave / Late Arrival, reused across every day-summary attendance
 * surface (AttendanceCard.jsx, AttendanceSidebarHR.jsx,
 * TodayAttendanceCard.jsx) so they can't silently drift out of sync with
 * each other, the way the sidebar's own hand-rolled copy of this and the
 * NaN%-bug bar previously did. All three inputs already come precomputed
 * from unified_daily_attendance (overtime_hours, is_early_leave,
 * is_late_arrival) -- this component has no thresholds of its own.
 *
 * Deliberately not used by AttendanceTimelineCard.jsx (no natural
 * per-activity concept -- these are day-level facts) or the Employees
 * directory (employees_public has no equivalent columns).
 */
export default function AttendanceAnomalyBadges({
  overtimeHours,
  isEarlyLeave,
  isLateArrival,
  isLeaveAttendanceConflict,
  isInsufficientHalfDayHours,
  hasLeaveFractionError,
  isWorkedOnHoliday,
  holidayHoursWorked,
}) {
  const hasAny =
    Number(overtimeHours) > 0 ||
    isEarlyLeave ||
    isLateArrival ||
    isLeaveAttendanceConflict ||
    isInsufficientHalfDayHours ||
    hasLeaveFractionError ||
    isWorkedOnHoliday;

  if (!hasAny) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "0.4rem",
        flexWrap: "wrap",
      }}
    >
      {Number(overtimeHours) > 0 && (
        <StatusBox
          status={`+${Number(overtimeHours).toFixed(1)}h OT`}
          type="red"
        />
      )}
      {/* {isEarlyLeave && <StatusBox status="Early Leave" type="red" />} */}
      {/* {isLateArrival && <StatusBox status="Late Arrival" type="red" />} */}

      {/* HR2000 leave/attendance conflict detection -- see
        hr_unified_daily_attendance_view.sql. */}
      {isLeaveAttendanceConflict && (
        <StatusBox status="Leave Conflict" type="red" />
      )}
      {isInsufficientHalfDayHours && (
        <StatusBox status="Insufficient Half-Day Hours" type="red" />
      )}
      {hasLeaveFractionError && (
        <StatusBox status="Leave Data Error" type="red" />
      )}

      {/* Public holidays integration -- a payroll-relevant fact, not
        necessarily an error, so this doesn't reuse the "red" conflict
        styling above. */}
      {isWorkedOnHoliday && (
        <StatusBox
          status={`${Number(holidayHoursWorked).toFixed(1)}h on Holiday`}
          type="blue"
        />
      )}
    </div>
  );
}

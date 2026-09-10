/**
 * Maps unified_daily_attendance's hr_flag to StatusBox's `type` class name.
 * Semantically identical to chartColors.js's ATTENDANCE_FLAG_COLORS, but
 * returns a CSS class (StatusBox's prop shape) instead of a hex value.
 */
export default function getHrFlagStatusType(hrFlag) {
  if (!hrFlag) return "grey";
  if (hrFlag.startsWith("On Leave")) return "purple";
  if (hrFlag.startsWith("Public Holiday")) return "blue";

  switch (hrFlag) {
    case "OK":
    case "Approved":
      return "green";
    case "Pending App Approval":
      return "yellow";
    case "Missing App Check-Out":
    case "Incomplete Card Scans":
    case "Absent":
      return "red";
    default:
      return "grey";
  }
}

/**
 * Display-time override for hr_flag -- unified_daily_attendance no longer
 * has a "Weekend / Rest Day" hr_flag value at all; a genuine unworked
 * Saturday/Sunday now comes back as hr_flag = "Absent", with the new
 * calendar-only is_weekend boolean carrying the weekend fact instead (see
 * hr_unified_daily_attendance_view.sql). Without this override, every
 * unworked weekend would render as a red "Absent" badge to every employee
 * and HR reviewer -- every StatusBox render site for hr_flag must go
 * through this instead of calling getHrFlagStatusType directly.
 */
export function getDisplayAttendanceFlag(hrFlag, isWeekend) {
  if (isWeekend && hrFlag === "Absent") {
    return { label: "Weekend", type: "grey" };
  }

  return { label: hrFlag, type: getHrFlagStatusType(hrFlag) };
}

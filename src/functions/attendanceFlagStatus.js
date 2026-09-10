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
    case "Weekend / Rest Day":
      return "grey";
    default:
      return "grey";
  }
}

// functions/attendanceAnomalyAnchors.js
//
// Moved out of attendanceFlagStatus.js when hr_flag was removed. That file
// held three things: two hr_flag label/colour helpers and this, which has
// nothing to do with hr_flag. Both helpers are gone, so keeping this in a file
// named after a column that no longer exists would have been exactly the kind
// of misleading name this rework set out to remove.

/**
 * Resolves which single attendance_activity_audit row in a day produced that
 * day's is_late_arrival / is_early_leave flags.
 *
 * Both flags are DAY-level facts (the day's first arrival vs. its last
 * departure), but the Activity Timeline renders one card per activity.
 * Painting every card would be wrong -- a 2pm Site Visit didn't cause the
 * day's late arrival, and a 3-card day would show 3 red chips for 1 fact.
 *
 * Exact, not approximate: unified_daily_attendance's first_in/last_out are
 * literally MIN/MAX across app_check_in/hw_check_in and app_check_out/
 * hw_check_out, so the row holding the minimum check_in_time IS the row those
 * columns were computed from.
 *
 * The "Rejected" exclusion is load-bearing, not defensive -- daily_app's own
 * MIN/MAX skip Rejected rows, so without it a rejected 07:00 session would win
 * "earliest" here and take the chip while the day-level flag came from a
 * different row entirely. Hardware rows carry 'System Verified' (never
 * 'Rejected') and so participate correctly.
 *
 * Shared by AttendanceSidebarHR.jsx and TodayAttendanceCard.jsx -- the two
 * surfaces that render AttendanceTimelineCard alongside a day-summary row.
 */
export function getAnomalyAnchorActivityIds(timelineData) {
  let earliest = null;
  let latest = null;

  for (const activity of timelineData || []) {
    if (activity.approval_status === "Rejected") continue;

    if (
      activity.check_in_time &&
      (!earliest || activity.check_in_time < earliest.check_in_time)
    ) {
      earliest = activity;
    }
    if (
      activity.check_out_time &&
      (!latest || activity.check_out_time > latest.check_out_time)
    ) {
      latest = activity;
    }
  }

  return {
    earliestActivityId: earliest?.activity_id ?? null,
    latestActivityId: latest?.activity_id ?? null,
  };
}

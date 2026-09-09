// components/attendance/attendanceDayTimelineBar/AttendanceDayTimelineBar.jsx

import Tooltip from "@/components/tooltip/Tooltip";
import { ATTENDANCE_TYPE_CONFIG } from "../attendanceType/attendanceTypeConfig";
import { formatTime } from "@/functions/formatDate";
import "./AttendanceDayTimelineBar.scss";

const DEFAULT_WINDOW_START_MIN = 8 * 60; // 8:00 AM
const DEFAULT_WINDOW_END_MIN = 18 * 60; // 6:00 PM

// Minutes-since-midnight in Asia/Kuala_Lumpur, regardless of the viewer's
// own browser timezone -- unlike this codebase's existing formatDate.js
// helpers (which rely on the runtime's local timezone for display, fine
// for text but not safe for precise bar-positioning math), this needs to
// be correct even if a viewer's machine isn't set to Malaysia time.
function minutesInMYT(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return get("hour") * 60 + get("minute") + get("second") / 60;
}

function formatMinutesAsTime(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * A guaranteed-minimum 8am-6pm reference window, so the same visual
 * proportion still means roughly the same thing across every employee/day
 * (HR reviews many of these in sequence) -- but the window widens to fit
 * any real activity outside it instead of clipping. Clipping would be
 * actively misleading, not just less detailed: someone who worked 7am-8pm
 * would otherwise render an identical-looking "full" bar to someone who
 * worked exactly 8-6, silently hiding the extra hours on both ends.
 */
// Removes `cut`'s time range from `base`, returning 0-2 pieces. Used to
// carve an app (remote) segment out of a hardware (scanner) segment it
// overlaps -- a badge can stay scanned in at the office across an entire
// remote-tagged app session in the middle of the day (e.g. attending a
// meeting from a desk without badging out), and a single 1-D bar can't
// show two simultaneous segments at the same position, so one has to take
// visual precedence. This mirrors the same "subtract the known remote
// overlap" logic the hours_worked fix already applies numerically
// (hr_unified_daily_attendance_view.sql's daily_hw_remote_overlap) --
// applied here to the visual segments instead of the hours total.
function subtractInterval(base, cut) {
  const pieces = [];
  if (cut.startMin > base.startMin) {
    pieces.push({ ...base, endMin: Math.min(cut.startMin, base.endMin) });
  }
  if (cut.endMin < base.endMin) {
    pieces.push({ ...base, startMin: Math.max(cut.endMin, base.startMin) });
  }
  return pieces.filter((piece) => piece.endMin > piece.startMin);
}

export default function AttendanceDayTimelineBar({ timelineData = [] }) {
  const allSegments = timelineData
    .filter((activity) => activity.check_in_time) // Leave rows have no
    // clock times at all -- not placeable on this axis; the "On Leave" chip
    // above this bar already covers that case.
    .map((activity) => {
      const startMin = minutesInMYT(new Date(activity.check_in_time));
      // An open row (no check_out_time) is treated as ongoing through at
      // least the default window end -- true whether this is today's still-
      // running session or a past day's Missing App Check-Out anomaly;
      // either way we don't know the real end, so this is a simple,
      // consistent floor rather than an attempt to guess "now".
      const endMin = activity.check_out_time
        ? minutesInMYT(new Date(activity.check_out_time))
        : Math.max(startMin, DEFAULT_WINDOW_END_MIN);

      return {
        type: activity.attendance_type,
        eventSource: activity.event_source,
        checkInTime: activity.check_in_time,
        checkOutTime: activity.check_out_time,
        startMin,
        endMin,
      };
    })
    .filter((seg) => seg.endMin > seg.startMin);

  // App (remote) segments always take visual precedence over Hardware
  // (scanner) ones -- they're the more specific, intentional signal ("I am
  // in this meeting right now"), whereas a scanner span is just "badge was
  // scanned in somewhere in this window." Carve every app segment out of
  // any hardware segment it overlaps, splitting the hardware segment into
  // its before/after pieces, before laying anything out in order.
  const appSegments = allSegments.filter((seg) => seg.eventSource === "App");
  let hwSegments = allSegments.filter((seg) => seg.eventSource === "Hardware");
  for (const appSeg of appSegments) {
    hwSegments = hwSegments.flatMap((hwSeg) => subtractInterval(hwSeg, appSeg));
  }

  const rawSegments = [...hwSegments, ...appSegments].sort(
    (a, b) => a.startMin - b.startMin,
  );

  const windowStart = rawSegments.length
    ? Math.min(DEFAULT_WINDOW_START_MIN, ...rawSegments.map((s) => s.startMin))
    : DEFAULT_WINDOW_START_MIN;
  const windowEnd = rawSegments.length
    ? Math.max(DEFAULT_WINDOW_END_MIN, ...rawSegments.map((s) => s.endMin))
    : DEFAULT_WINDOW_END_MIN;

  // Fill gaps (window start -> first segment, between segments, last
  // segment -> window end) with a neutral filler.
  const segments = [];
  let cursor = windowStart;

  for (const seg of rawSegments) {
    if (seg.startMin > cursor) {
      segments.push({ type: null, startMin: cursor, endMin: seg.startMin });
    }
    segments.push(seg);
    cursor = Math.max(cursor, seg.endMin);
  }
  if (cursor < windowEnd) {
    segments.push({ type: null, startMin: cursor, endMin: windowEnd });
  }
  if (segments.length === 0) {
    segments.push({ type: null, startMin: windowStart, endMin: windowEnd });
  }

  return (
    <div className="attendanceDayTimelineBar">
      <div className="attendanceDayTimelineBarTrack">
        {segments.map((seg, i) => {
          const className = seg.type
            ? ATTENDANCE_TYPE_CONFIG[seg.type.toLowerCase().trim()]?.className ||
              "default"
            : "grey";
          const tooltipContent = seg.type
            ? `${seg.type}: ${formatTime(seg.checkInTime)} - ${
                seg.checkOutTime ? formatTime(seg.checkOutTime) : "ongoing"
              }`
            : "No activity";

          return (
            <Tooltip key={i} content={tooltipContent}>
              <div
                className={`attendanceDayTimelineBarSegment ${className}`}
                style={{ flex: seg.endMin - seg.startMin }}
              />
            </Tooltip>
          );
        })}
      </div>
      <div className="attendanceDayTimelineBarLabels">
        <span className="textXXXS textLight">
          {formatMinutesAsTime(windowStart)}
        </span>
        <span className="textXXXS textLight">
          {formatMinutesAsTime(windowEnd)}
        </span>
      </div>
    </div>
  );
}

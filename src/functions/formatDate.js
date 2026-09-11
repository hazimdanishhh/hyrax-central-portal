/**
 * Shared date/time formatters (en-MY).
 *
 * These were previously copy-pasted, byte-for-byte, across ~9 fetch/normalize
 * services in src/features/**. Import from here instead of re-declaring them.
 * All three return null for empty/falsy input so they're safe to map over rows.
 */

export function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-MY", {
    dateStyle: "medium",
  });
}

export function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-MY", {
    timeStyle: "short",
  });
}

const MYT_TIME_ZONE = "Asia/Kuala_Lumpur";
const MYT_UTC_OFFSET = "+08:00"; // Malaysia has no DST -- a fixed offset is
// always correct, unlike deriving it from the viewer's own browser
// timezone (which `new Date(...).toISOString()` implicitly does).

/**
 * "HH:mm" from a timestamp, in Asia/Kuala_Lumpur, regardless of the
 * viewer's own browser timezone -- seeds a native <input type="time">
 * (see TimeEditor.jsx) from an existing Malaysia-local timestamp. Unlike
 * formatTime() above, this is for a form's CURRENT VALUE, not a read-only
 * display string, so it can't rely on the browser's local interpretation.
 */
export function toMYTTimeInputValue(value) {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MYT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("hour")}:${get("minute")}`;
}

// "YYYY-MM-DD" from either an already-plain date string (e.g. a `date`
// column) or a full timestamp, read in Asia/Kuala_Lumpur -- so a
// timestamp near midnight resolves to the correct MYT calendar day, not
// whatever day the viewer's own browser timezone would derive.
function toMYTDatePart(referenceDate) {
  if (!referenceDate) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) return referenceDate;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MYT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(referenceDate));
  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Combines a reference date (a plain "YYYY-MM-DD", or any timestamp to
 * derive one from) with a "HH:mm" time-of-day into one instant, correct in
 * Asia/Kuala_Lumpur regardless of the viewer's own browser timezone -- a
 * fixed +08:00 offset, not `new Date(...).toISOString()` (which interprets
 * the input as the BROWSER's local time -- wrong for a viewer whose
 * machine isn't set to Malaysia time). See TimeEditor.jsx.
 */
export function combineMYTDateAndTime(referenceDate, timeValue) {
  if (!referenceDate || !timeValue) return null;

  const datePart = toMYTDatePart(referenceDate);
  if (!datePart) return null;

  return `${datePart}T${timeValue}:00${MYT_UTC_OFFSET}`;
}

/**
 * "2h ago" / "3d ago" style relative time -- for staleness displays (e.g.
 * pipeline last-synced) where the exact timestamp matters less than how
 * long ago it was.
 */
export function formatRelativeTime(value) {
  if (!value) return null;

  const diffMinutes = Math.round(
    (Date.now() - new Date(value).getTime()) / 60000,
  );

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

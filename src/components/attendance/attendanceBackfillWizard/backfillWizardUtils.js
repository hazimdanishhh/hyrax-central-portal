// Shape/default computation for the Backfill Attendance wizard.
//
// Kept out of the component so the "what times should this default to" rule
// lives in one readable place -- it is the part of this feature most likely to
// need adjusting when HR confirms a real shift schedule.

// The three shapes a backfilled day can take. AM/PM exist because the most
// common reconciliation case after a full missing day is a half-day leave
// whose *working* half was never recorded (unified_daily_attendance's
// is_insufficient_half_day_hours flag).
export const DAY_SHAPES = [
  { value: "full", label: "Full Day" },
  { value: "am_half", label: "Half Day (AM)" },
  { value: "pm_half", label: "Half Day (PM)" },
];

// Shift start, and the boundaries of the unpaid lunch hour.
//
// 08:30 is not arbitrary: it is the same start time
// hr_unified_daily_attendance_view.sql's normal_hours_threshold already
// assumes ("08:30 start to the employee's work_locations.early_leave_time,
// minus a flat 1-hour unpaid lunch"). Matching it is what makes a backfilled
// full day come out EXACTLY on the threshold and therefore generate zero
// phantom overtime. A flat 08:00-17:00 would hand every KL employee 0.5h of
// spurious estimated_normal_day_ot_hours on every backfilled day.
const SHIFT_START = "08:30";
const LUNCH_START = "12:30";
const LUNCH_END = "13:00";

// Fallback when an employee has no work_location_id -- the same COALESCE
// default the view itself applies.
const DEFAULT_SHIFT_END = "17:00";

/**
 * Is this attendance type recorded as whole days rather than a clock in/out
 * pair? Reads the `is_full_day` column -- see its comment in
 * attendance_types_add_is_self_selectable_column.sql for why the trip types
 * are the only ones, which is a statement about the data, not about this code.
 *
 * Takes the type OBJECT, not its name. A previous version matched on lowercased
 * name against a hardcoded list, which would have broken silently the first
 * time someone renamed a type in Studio.
 *
 * `=== true`, not `!== false`: an unrecognised or pre-migration row (where the
 * column is undefined) must fall back to TIMED, which shows visible, editable
 * time inputs. The opposite default would silently record a whole day.
 * Deliberately the inverse polarity of `is_self_selectable !== false` in
 * attendanceActivityConfig.js -- there the safe fallback is "offer it", here
 * the safe fallback is "ask for the times".
 */
export function isFullDayType(type) {
  return type?.is_full_day === true;
}

/** Postgres `time` comes back as "17:00:00"; the <input type="time"> wants "17:00". */
export function toTimeInput(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

/**
 * Default clock in/out for one (shape, employee) pair.
 *
 * shiftEndTime is that employee's own work_locations.early_leave_time
 * (KL 17:00, Meru 17:30), so a Meru full day correctly runs half an hour
 * longer than a KL one rather than both being flattened to a company-wide
 * guess.
 */
export function defaultTimesForShape(shape, shiftEndTime) {
  const end = toTimeInput(shiftEndTime) || DEFAULT_SHIFT_END;

  switch (shape) {
    case "am_half":
      return { clockIn: SHIFT_START, clockOut: LUNCH_START };
    case "pm_half":
      return { clockIn: LUNCH_END, clockOut: end };
    case "full":
    default:
      return { clockIn: SHIFT_START, clockOut: end };
  }
}

/** "YYYY-MM-DD" for a local Date, without going through UTC. */
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Inclusive list of "YYYY-MM-DD" between two date strings.
 *
 * Built from local y/m/d components rather than Date parsing of the ISO string
 * -- `new Date("2026-09-21")` is parsed as UTC midnight, which in MYT (UTC+8)
 * is still the 21st but in a negative-offset timezone would be the 20th. Only
 * the calendar components are ever read here, so this stays correct wherever
 * the browser happens to be.
 *
 * Capped at 366 days: this feeds one prefill RPC call per (employee x date)
 * pair, so an accidental decade-wide range would be a very expensive mistake.
 */
export function expandDateRange(startDate, endDate, maxDays = 366) {
  if (!startDate || !endDate) return [];

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (!sy || !ey) return [];

  const cursor = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  if (cursor > last) return [];

  const dates = [];
  while (cursor <= last && dates.length < maxDays) {
    dates.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

/** "Mon, 21 Sep 2026" for a date-row label. */
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-MY", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDateLabel(dateString) {
  if (!dateString) return "";
  const [y, m, d] = dateString.split("-").map(Number);
  return DATE_LABEL_FORMATTER.format(new Date(y, m - 1, d));
}

/** Today as "YYYY-MM-DD", used to mark future dates in the wizard. */
export function todayDateString() {
  return toDateString(new Date());
}

/**
 * Should this (employee, date) cell start unticked?
 *
 * Anything that already looks accounted for, or that carries a payroll
 * consequence beyond simply filling a gap, requires an explicit decision
 * rather than being swept in by a range selection:
 *   - weekend / public holiday -> feeds the rest-day and holiday statutory
 *     wage tiers and the Weekend/Holiday Work KPIs
 *   - already has attendance   -> the RPC would skip it anyway
 *   - full day of leave already on record
 */
export function shouldPreselectDate(prefillRows) {
  if (!prefillRows?.length) return true; // unknown date -- let the user decide

  return prefillRows.every(
    (row) =>
      !row.is_weekend &&
      !row.is_public_holiday &&
      !row.has_existing_attendance &&
      !(row.is_on_leave && Number(row.leave_day_fraction) >= 1),
  );
}

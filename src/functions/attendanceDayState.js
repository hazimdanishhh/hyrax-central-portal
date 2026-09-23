// functions/attendanceDayState.js
//
// The single vocabulary for unified_daily_attendance's axis columns -- the
// replacement for hr_flag across the whole attendance/payroll surface.
//
// WHY THIS FILE EXISTS
//
// hr_flag was one string that had to answer four unrelated questions at once
// (what kind of calendar day, what leave was recorded, how complete the
// evidence is, what its approval state is) by picking a single winner via
// branch order. That made real states unreachable rather than merely
// mislabelled: an approved-but-never-clocked-out session could never read
// 'Missing App Check-Out' because 'Approved' won first. The view now exposes
// those as independent columns; this file is where each one's user-facing
// wording and colour is decided, ONCE.
//
// Everything downstream -- filter dropdowns, status tabs, StatusBox badges,
// chart colours, deep links -- must read from the arrays below rather than
// hardcoding strings. hr_flag accumulated FOUR different spellings of "leave
// conflict" and THREE of "unacknowledged absence" precisely because each
// surface wrote its own. A filter option whose value is not a real column
// value silently returns nothing, and nothing in the UI reports that.
//
// `type` values are StatusBox class names (grey/green/yellow/red/purple/blue),
// matching getHrFlagStatusType's existing vocabulary so no styling work is
// needed to adopt these.

// ---------------------------------------------------------------------------
// DAY STATE -- the primary "what kind of day was this" label, and the one
// thing HR filters on day to day. A pure function of the axis columns, so it
// cannot drift from them.
//
// Grouped because the filter dropdown reads better grouped than as a flat list
// of fifteen: HR almost always wants one group at a time ("show me the
// problems", "show me holiday work").
// ---------------------------------------------------------------------------
export const DAY_STATE_GROUPS = [
  {
    group: "Ordinary Days",
    states: [
      { value: "worked", label: "Worked", type: "green" },
      { value: "absent", label: "Absent", type: "red" },
      { value: "on_leave", label: "On Leave", type: "purple" },
      { value: "on_leave_partial", label: "On Leave (Partial)", type: "purple" },
    ],
  },
  {
    group: "Needs Reconciliation",
    states: [
      { value: "leave_conflict", label: "Leave/Attendance Conflict", type: "red" },
      { value: "insufficient_half_day", label: "Insufficient Half-Day Hours", type: "yellow" },
      { value: "leave_data_error", label: "Leave Data Error", type: "red" },
    ],
  },
  {
    group: "Weekend",
    states: [
      { value: "weekend", label: "Weekend", type: "grey" },
      { value: "weekend_worked", label: "Weekend (Worked)", type: "blue" },
      { value: "weekend_on_leave", label: "Weekend (On Leave)", type: "grey" },
    ],
  },
  {
    group: "Public Holiday",
    states: [
      { value: "public_holiday", label: "Public Holiday", type: "blue" },
      { value: "public_holiday_worked", label: "Public Holiday (Worked)", type: "blue" },
      { value: "public_holiday_on_leave", label: "Public Holiday (On Leave)", type: "blue" },
      { value: "weekend_public_holiday", label: "Weekend + Public Holiday", type: "blue" },
      {
        value: "weekend_public_holiday_worked",
        label: "Weekend + Public Holiday (Worked)",
        type: "blue",
      },
    ],
  },
];

// Flattened lookup, built from the grouped list above rather than maintained
// separately -- the two can never disagree about which states exist.
const DAY_STATE_BY_VALUE = Object.fromEntries(
  DAY_STATE_GROUPS.flatMap((g) => g.states).map((s) => [s.value, s]),
);

export const DAY_STATE_OPTIONS = DAY_STATE_GROUPS.flatMap((g) =>
  g.states.map((s) => ({ label: `${g.group} — ${s.label}`, value: s.value })),
);

/**
 * Label + StatusBox type for a day_state value.
 *
 * Replaces getDisplayAttendanceFlag, whose weekend special-case exists only
 * because hr_flag could not represent "weekend" at all -- an unworked Saturday
 * came back as hr_flag = 'Absent' and every render site had to override it to
 * avoid showing a red absence. day_state distinguishes them natively, so no
 * override is needed here.
 *
 * Falls back to the raw value rather than a placeholder: if the view ever
 * gains a state this file does not know about, showing the unfamiliar value is
 * far more debuggable than a silent "Unknown" that looks intentional.
 */
export function getDayStateDisplay(dayState) {
  if (!dayState) return { label: "—", type: "grey" };
  return DAY_STATE_BY_VALUE[dayState] ?? { label: dayState, type: "grey" };
}

/** The states that are HR's problem queue. Mirrors the "Needs Reconciliation" group. */
export const RECONCILIATION_DAY_STATES = DAY_STATE_GROUPS.find(
  (g) => g.group === "Needs Reconciliation",
).states.map((s) => s.value);

// ---------------------------------------------------------------------------
// EVIDENCE QUALITY -- "is the record complete", independent of where it came
// from and whether it was approved.
//
// 'single_scan_and_open_session' is the value that justifies this being its
// own axis: a day can have both defects, and hr_flag structurally could not
// say so -- its 'Missing App Check-Out' branch sat above 'Incomplete Card
// Scans', and in practice neither fired because the approval branches sat
// above both.
//
// 'complete' and 'none' deliberately have no badge. 'complete' means "nothing
// is missing from what was recorded", NOT "this day is fine", so badging it
// green would overstate it.
// ---------------------------------------------------------------------------
export const EVIDENCE_QUALITY_OPTIONS = [
  { value: "complete", label: "Complete", type: null },
  { value: "single_scan", label: "Incomplete Card Scans", type: "red" },
  { value: "open_session", label: "Missing App Check-Out", type: "red" },
  {
    value: "single_scan_and_open_session",
    label: "Incomplete Scans + Missing Check-Out",
    type: "red",
  },
  { value: "none", label: "No Evidence", type: null },
];

const EVIDENCE_QUALITY_BY_VALUE = Object.fromEntries(
  EVIDENCE_QUALITY_OPTIONS.map((o) => [o.value, o]),
);

// ---------------------------------------------------------------------------
// APPROVAL STATE -- app activities only. Hardware scans are facts, not claims,
// so they are 'not_applicable' rather than implicitly approved.
//
// 'rejected_only' is NOT the same as 'not_applicable': something was claimed
// and refused, which is worth being able to find. Such a day contributes no
// hours and no app_check_in, so under hr_flag it simply read as 'Absent' when
// there was no badge scan -- the refusal was invisible.
// ---------------------------------------------------------------------------
export const APPROVAL_STATE_OPTIONS = [
  { value: "approved", label: "Approved", type: "green" },
  { value: "pending", label: "Pending Approval", type: "yellow" },
  { value: "rejected_only", label: "Rejected", type: "red" },
  { value: "not_applicable", label: "No App Activity", type: null },
];

const APPROVAL_STATE_BY_VALUE = Object.fromEntries(
  APPROVAL_STATE_OPTIONS.map((o) => [o.value, o]),
);

// ---------------------------------------------------------------------------
// EVIDENCE SOURCE -- "where did we learn about this day". Previously
// unanswerable: hr_flag conflated "came from the app" with "was approved", so
// there was no way to ask for days known only from a badge scan.
// ---------------------------------------------------------------------------
export const EVIDENCE_SOURCE_OPTIONS = [
  { value: "hardware", label: "Card Scan Only" },
  { value: "app", label: "App Only" },
  { value: "both", label: "Card Scan + App" },
  { value: "none", label: "No Record" },
];

// ---------------------------------------------------------------------------
// CALENDAR TYPE -- replaces the dayType working/weekend toggle, which could
// not express "public holiday" or the weekend-that-is-also-a-holiday overlap
// (the latter contributes to BOTH statutory wage tiers -- intended, but
// previously invisible and unqueryable).
// ---------------------------------------------------------------------------
export const DAY_CALENDAR_TYPE_OPTIONS = [
  { value: "ordinary", label: "Working Day" },
  { value: "weekend", label: "Weekend" },
  { value: "public_holiday", label: "Public Holiday" },
  { value: "weekend_public_holiday", label: "Weekend + Public Holiday" },
];

// ---------------------------------------------------------------------------
// LEAVE STATE
//
// 'partial' is not cosmetic. is_insufficient_half_day_hours tests
// `leave_day_fraction = 0.5` EXACTLY, so a 0.25 or 0.75 day currently matches
// no leave branch anywhere -- a zero-attendance 0.75 day renders as a plain
// red Absent. This value makes those findable.
// ---------------------------------------------------------------------------
export const LEAVE_STATE_OPTIONS = [
  { value: "none", label: "No Leave" },
  { value: "half_day", label: "Half Day" },
  { value: "full_day", label: "Full Day" },
  { value: "partial", label: "Partial (Other Fraction)" },
  { value: "over_full_day", label: "More Than One Day (Data Error)" },
];

/**
 * Counts EXPECTED WORKING DAYS between two dates, inclusive -- the client-side
 * mirror of unified_daily_attendance's `is_expected_working_day`.
 *
 * WHY THIS EXISTS RATHER THAN READING THE COLUMN
 *
 * The obvious implementation is to count rows from the view. It is avoided on
 * purpose: the only caller needs a year-to-date figure, and the view is
 * expensive over wide ranges (see docs/setup/ATTENDANCE-DAY-MODEL-DEPLOYMENT-
 * GUIDE.md section 2 -- large periods currently time out). This reads the
 * public_holidays table instead, which has tens of rows.
 *
 * It is computed from the SAME source data as the column, so the two agree:
 *
 *   is_expected_working_day  ==  NOT is_weekend AND no holiday that day
 *
 * The holiday test mirrors the view's daily_holiday CTE: a holiday applies to
 * an employee when its work_location_id matches theirs OR is null
 * (company-wide). The view's DISTINCT ON precedence only decides which NAME
 * wins when both exist; for "is this a holiday at all", either match is
 * enough. An employee with no work location therefore gets company-wide
 * holidays only -- same as the view, where `ph.work_location_id =
 * e.work_location_id` is null and cannot match.
 *
 * Dates are built from y/m/d components rather than parsed from ISO strings:
 * `new Date("2026-09-23")` is UTC midnight, which in a negative-offset
 * timezone is the previous day. Only calendar components are read here, so
 * this stays correct wherever the browser is -- the same reasoning as
 * backfillWizardUtils.js's expandDateRange.
 *
 * REPLACES a Mon-Fri counter that had no holiday awareness at all, so the
 * denominator it fed could never match any server-side figure.
 */
export function countExpectedWorkingDays(
  startDate,
  endDate,
  holidays = [],
  workLocationId = null,
) {
  if (!startDate || !endDate) return 0;

  const holidayDates = new Set(
    (holidays || [])
      .filter(
        (h) =>
          h.work_location_id == null || h.work_location_id === workLocationId,
      )
      .map((h) => String(h.holiday_date).slice(0, 10)),
  );

  const [sy, sm, sd] = String(startDate).slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = String(endDate).slice(0, 10).split("-").map(Number);
  if (!sy || !ey) return 0;

  const cursor = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);

  let count = 0;
  while (cursor <= last) {
    const dow = cursor.getDay();
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;

    // Saturday (6) / Sunday (0) -- matches the view's
    // EXTRACT(ISODOW ...) IN (6, 7).
    if (dow !== 0 && dow !== 6 && !holidayDates.has(iso)) count += 1;

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/**
 * Turns a breakdown array from the dashboard RPCs -- [{ name, value }] where
 * `name` is the RAW column value -- into chart-ready rows whose `name` is the
 * display label.
 *
 * The RPCs deliberately emit raw snake_case rather than labels so the wording
 * is decided in exactly one place (this file). Without that, a chart legend
 * could drift from the filter dropdown and the row badges, which is precisely
 * how hr_flag ended up with four spellings of "leave conflict".
 *
 * The chart colour maps in chartColors.js are keyed on these same labels, so
 * the mapping has to happen before rendering or every slice falls through to
 * PieChartRenderer's unmapped grey.
 *
 * `lookup` defaults to day_state; pass EVIDENCE_QUALITY_OPTIONS or
 * APPROVAL_STATE_OPTIONS to relabel those breakdowns instead.
 */
export function toLabelledBreakdown(rows, lookup = DAY_STATE_BY_VALUE) {
  const byValue = Array.isArray(lookup)
    ? Object.fromEntries(lookup.map((o) => [o.value, o]))
    : lookup;

  return (rows || []).map((row) => ({
    ...row,
    name: byValue[row.name]?.label ?? row.name,
  }));
}

/**
 * Every data-quality / approval badge a row should show ALONGSIDE its
 * day_state badge, as [{ label, type }].
 *
 * These are deliberately separate from day_state rather than folded into it.
 * A day is `worked` AND evidence_quality='single_scan' AND
 * approval_state='pending' -- three independent facts, three badges, all true
 * at once. Folding them into one label is exactly what made hr_flag lose
 * information.
 *
 * Returns [] for a clean day, so a caller can render nothing without a
 * null check.
 */
export function getDayQualityBadges(row) {
  if (!row) return [];

  const badges = [];

  const quality = EVIDENCE_QUALITY_BY_VALUE[row.evidence_quality];
  if (quality?.type) badges.push({ label: quality.label, type: quality.type });

  // Only Pending and Rejected are worth a badge. 'approved' is the expected
  // outcome and badging it would add noise to almost every app day; it stays
  // available as a filter.
  const approval = APPROVAL_STATE_BY_VALUE[row.approval_state];
  if (approval?.type && row.approval_state !== "approved") {
    badges.push({ label: approval.label, type: approval.type });
  }

  return badges;
}

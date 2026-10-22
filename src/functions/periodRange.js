// functions/periodRange.js
// Period maths for PeriodSelector: Month / Quarter / Fiscal Year / Calendar
// Year, each always a FULL period (1st of the first month through the last
// day of the last month), never "to date" -- DASHBOARD-CONVENTIONS.md §4b.
//
// Every period is stored as the same { startDate, endDate } 'YYYY-MM-DD' pair
// the date-range filters already write, so a page's RPC, its URL and every
// chart drill-through link keep working unchanged. The MODE is never stored:
// it is read back off the dates (classifyRange), the same way
// FiscalYearFilterBar recognises its own ranges. A pair that matches no mode
// is "custom" and steps by its own length, as SearchFilterBar's arrows always
// have.
//
// Months are handled as integer indexes (year * 12 + month0), never by
// parsing ISO strings into Dates and doing arithmetic on them, so no
// timezone or month-length drift can creep in. No date library in this repo.

// April. Hyrax's fiscal year runs April -> March, same as fiscalYearPresets.js.
const FY_START_MONTH0 = 3;

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function todayDateString() {
  return toDateString(new Date());
}

function monthIndex(dateString) {
  const [year, month] = dateString.split("-").map(Number);
  return year * 12 + (month - 1);
}

// Day 0 of the following month is the last day of this one.
function lastDayOf(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

// { startDate, endDate } for `length` whole months starting at month index i.
function monthSpan(i, length) {
  const endIdx = i + length - 1;
  const sy = Math.floor(i / 12);
  const sm = i % 12;
  const ey = Math.floor(endIdx / 12);
  const em = endIdx % 12;
  return {
    startDate: `${sy}-${pad(sm + 1)}-01`,
    endDate: `${ey}-${pad(em + 1)}-${pad(lastDayOf(ey, em))}`,
  };
}

const mod = (n, m) => ((n % m) + m) % m;

// Each mode: how many months long, and the first month of the period that
// contains month index i. Order matters for classifyRange -- FY and Calendar
// Year are both 12 months and are told apart only by where they start.
export const PERIOD_MODES = [
  {
    mode: "month",
    label: "Month",
    shortLabel: "Month",
    noun: "month",
    length: 1,
    startOf: (i) => i,
  },
  {
    mode: "quarter",
    label: "Quarter",
    shortLabel: "Qtr",
    noun: "quarter",
    length: 3,
    // Calendar quarters and fiscal quarters are the SAME date ranges because
    // the fiscal year starts on a quarter boundary (April); only the "Q"
    // number differs, and formatPeriod labels it the fiscal way.
    startOf: (i) => i - mod(i, 3),
  },
  {
    mode: "fiscalYear",
    label: "Fiscal Year",
    shortLabel: "FY",
    noun: "fiscal year",
    length: 12,
    startOf: (i) => i - mod(i - FY_START_MONTH0, 12),
  },
  {
    mode: "year",
    label: "Calendar Year",
    shortLabel: "Year",
    noun: "year",
    length: 12,
    startOf: (i) => i - mod(i, 12),
  },
];

const MODE_BY_KEY = Object.fromEntries(PERIOD_MODES.map((m) => [m.mode, m]));

export function getPeriodMode(mode) {
  return MODE_BY_KEY[mode] || null;
}

/** The full `mode` period that contains `dateString`. */
export function periodContaining(mode, dateString) {
  const def = MODE_BY_KEY[mode];
  return monthSpan(def.startOf(monthIndex(dateString)), def.length);
}

/**
 * Which mode a date pair is, or "custom". Only exact full periods count: a
 * range must start on the 1st of the mode's own first month and end on the
 * last day of its last month.
 */
export function classifyRange(startDate, endDate) {
  if (!isDateString(startDate) || !isDateString(endDate)) return "custom";

  const startIdx = monthIndex(startDate);
  const endIdx = monthIndex(endDate);
  const [ey, em] = endDate.split("-").map(Number);
  const startsOnFirst = startDate.endsWith("-01");
  const endsOnLast = Number(endDate.slice(8)) === lastDayOf(ey, em - 1);

  if (!startsOnFirst || !endsOnLast) return "custom";

  const length = endIdx - startIdx + 1;
  const match = PERIOD_MODES.find(
    (m) => m.length === length && m.startOf(startIdx) === startIdx,
  );
  return match ? match.mode : "custom";
}

/**
 * The period a page is showing, read from its filters.
 *
 * `defaultMode` is the period the page's RPC already uses when it is sent no
 * dates (Sales Reports: the full current month, see
 * get_sales_reports_dashboard_rpc.sql's v_effective_start_date). Empty dates
 * are shown as that mode's current period, and `isDefault` is true.
 */
export function readPeriod(filters, defaultMode = "month") {
  const startDate = filters?.startDate || "";
  const endDate = filters?.endDate || "";

  if (!startDate && !endDate) {
    return {
      mode: defaultMode,
      ...periodContaining(defaultMode, todayDateString()),
      isDefault: true,
    };
  }

  return {
    mode: classifyRange(startDate, endDate),
    startDate,
    endDate,
    isDefault: false,
  };
}

/**
 * The filter values to write for a period. The current period of
 * `defaultMode` is written as EMPTY dates, not as its explicit range: on
 * Sales Reports empty dates also mean "show the true current backlog" on the
 * ACTIONABLE card and "all history" on the two trend charts, so writing the
 * explicit range would silently change those (DASHBOARD-CONVENTIONS.md §4b).
 * Returning to this month therefore puts the page back exactly as it loads.
 */
export function periodToFilters(range, defaultMode = "month") {
  if (defaultMode) {
    const current = periodContaining(defaultMode, todayDateString());
    if (
      range.startDate === current.startDate &&
      range.endDate === current.endDate
    ) {
      return { startDate: "", endDate: "" };
    }
  }
  return { startDate: range.startDate, endDate: range.endDate };
}

// Shifts the WHOLE range by its own length. Moved verbatim from
// SearchFilterBar (2026-10-22) so both controls step custom ranges the same
// way. A whole-calendar-month range (1st of a month through the last day of
// a month, possibly spanning several consecutive months) shifts by MONTHS,
// so e.g. May shifted back lands on the whole of April (Apr 1-30), not "31
// days earlier" (which would drift into March because April is shorter than
// May). Any other range (partial months, weeks, arbitrary custom ranges)
// shifts by a fixed day count, which is already correct for those.
export function shiftDateRange(startDate, endDate, direction) {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);

  if (start.getDate() === 1 && isLastOfMonth(end)) {
    const monthSpanLength =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1;
    const newStart = new Date(
      start.getFullYear(),
      start.getMonth() + direction * monthSpanLength,
      1,
    );
    const newEnd = new Date(
      newStart.getFullYear(),
      newStart.getMonth() + monthSpanLength,
      0, // day 0 = last day of the previous month
    );

    return { startDate: toDateString(newStart), endDate: toDateString(newEnd) };
  }

  const spanDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

  start.setDate(start.getDate() + direction * spanDays);
  end.setDate(end.getDate() + direction * spanDays);

  return { startDate: toDateString(start), endDate: toDateString(end) };
}

// Rolling forward one day lands in the next month iff d was that month's
// last day -- avoids hardcoding month lengths/leap years.
function isLastOfMonth(d) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next.getDate() === 1;
}

/** One step back (-1) or forward (+1), keeping the mode. */
export function stepPeriod(period, direction) {
  const def = MODE_BY_KEY[period.mode];
  if (!def) {
    return shiftDateRange(period.startDate, period.endDate, direction);
  }
  return monthSpan(
    monthIndex(period.startDate) + direction * def.length,
    def.length,
  );
}

/** True when today falls inside the period. */
export function isCurrentPeriod(period) {
  const today = todayDateString();
  return period.startDate <= today && today <= period.endDate;
}

const MONTH_LONG = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "1 Oct – 31 Dec 2026", or "1 Apr 2026 – 31 Mar 2027" across a year end. */
export function formatDateRange(startDate, endDate) {
  if (!isDateString(startDate) || !isDateString(endDate)) {
    return [startDate, endDate].filter(Boolean).join(" – ") || "";
  }
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  const startText =
    start.getFullYear() === end.getFullYear()
      ? DAY_MONTH.format(start)
      : DAY_MONTH_YEAR.format(start);
  return `${startText} – ${DAY_MONTH_YEAR.format(end)}`;
}

function fiscalYearLabel(startYear) {
  return `FY ${startYear}-${startYear + 1}`;
}

/**
 * Everything a report page needs to label its figures, from its filters:
 * the period (readPeriod) plus `title`/`range` (formatPeriod), `hasDates`
 * (both dates explicitly set -- what the RPCs' own v_has_period tests), and
 * `previousLabel` for deltas ("last month", "last fiscal year", or
 * "previous period" for a custom range), matching the window the RPC
 * compares against.
 */
export function describePeriod(filters, defaultMode = "month") {
  const period = readPeriod(filters, defaultMode);
  const def = MODE_BY_KEY[period.mode];
  return {
    ...period,
    ...formatPeriod(period),
    hasDates: Boolean(filters?.startDate && filters?.endDate),
    previousLabel: def ? `last ${def.noun}` : "previous period",
  };
}

/**
 * Display text for a period: `title` is the period's name ("October 2026",
 * "Q3 FY 2026-2027", "FY 2026-2027", "2026"), `range` its exact dates.
 */
export function formatPeriod(period) {
  const range = formatDateRange(period.startDate, period.endDate);
  if (period.mode === "custom") return { title: range || "Custom range", range: "Custom range" };

  const [year, month] = period.startDate.split("-").map(Number);
  const fyStartYear = month - 1 >= FY_START_MONTH0 ? year : year - 1;

  switch (period.mode) {
    case "month":
      return { title: MONTH_LONG.format(new Date(year, month - 1, 1)), range };
    case "quarter": {
      const q = Math.floor(mod(month - 1 - FY_START_MONTH0, 12) / 3) + 1;
      return { title: `Q${q} ${fiscalYearLabel(fyStartYear)}`, range };
    }
    case "fiscalYear":
      return { title: fiscalYearLabel(fyStartYear), range };
    default:
      return { title: String(year), range };
  }
}

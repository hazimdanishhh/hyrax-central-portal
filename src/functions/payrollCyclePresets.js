// functions/payrollCyclePresets.js
// Payroll-cycle presets for PayrollCycleFilterBar -- mirrors
// fiscalYearPresets.js's exact structure (plain Date math, no date library,
// a getRange() closure per preset), but for a fixed-day payroll cut-off
// instead of an April-March fiscal year.
//
// PAYROLL_CYCLE_START_DAY is a documented placeholder (26th-to-25th),
// pending HR confirmation of the real cut-off date -- same "flag the
// assumption in place" convention this codebase already uses for the
// leave-type needs_hr_confirmation flags and the 09:00/18:00 late/early
// thresholds in get_attendance_dashboard_rpc.sql. Every day of every month
// (28-31) is >= 26, so no month-length edge case exists for either the
// start day or the day-1 end day.

const PAYROLL_CYCLE_START_DAY = 26;

const PAYROLL_PERIODS_BACK = 11; // + current period = 12 options, matches FISCAL_YEAR_PRESETS' depth.

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Which payroll period (identified by its start year/month, 0-indexed month)
// contains "today" -- if today's day-of-month is already past the cut-off,
// the current period started this calendar month; otherwise it started last
// calendar month.
function getCurrentPayrollPeriodStart(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (day >= PAYROLL_CYCLE_START_DAY) {
    return { year, month };
  }

  return month === 0
    ? { year: year - 1, month: 11 }
    : { year, month: month - 1 };
}

function buildPayrollPeriod(startYear, startMonth) {
  const endMonth = startMonth === 11 ? 0 : startMonth + 1;
  const endYear = startMonth === 11 ? startYear + 1 : startYear;

  return {
    label: `${MONTH_NAMES[startMonth]} ${PAYROLL_CYCLE_START_DAY} – ${MONTH_NAMES[endMonth]} ${PAYROLL_CYCLE_START_DAY - 1}`,
    startYear,
    startMonth,
    getRange: () => ({
      startDate: toDateString(startYear, startMonth + 1, PAYROLL_CYCLE_START_DAY),
      endDate: toDateString(endYear, endMonth + 1, PAYROLL_CYCLE_START_DAY - 1),
    }),
  };
}

const current = getCurrentPayrollPeriodStart();

// Most recent first, same convention as FISCAL_YEAR_PRESETS.
export const PAYROLL_CYCLE_PRESETS = Array.from(
  { length: PAYROLL_PERIODS_BACK + 1 },
  (_, i) => {
    const totalMonths = current.year * 12 + current.month - i;
    return buildPayrollPeriod(Math.floor(totalMonths / 12), ((totalMonths % 12) + 12) % 12);
  },
);

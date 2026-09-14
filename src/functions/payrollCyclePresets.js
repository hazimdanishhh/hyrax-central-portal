// functions/payrollCyclePresets.js
// Payroll-cycle presets for PayrollCycleFilterBar -- plain calendar months
// (1st to last day), labeled by full month name + year (e.g. "September
// 2026"). Replaces the earlier 26th-to-25th placeholder cutoff
// (PAYROLL_CYCLE_START_DAY) entirely -- HR actually runs payroll against
// the calendar month, backdated. See docs/PAYROLL-DATA-REQUIREMENTS.md §6.
// Mirrors fiscalYearPresets.js's structure otherwise (plain Date math, no
// date library, a getRange() closure per preset).
//
// send_payroll_reconciliation_notifications.sql (supabase/functions/)
// computes its own period the same way (1st-last day of the previous
// calendar month) -- keep the two in sync.

const PAYROLL_PERIODS_BACK = 11; // + current period = 12 options, matches FISCAL_YEAR_PRESETS' depth.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastDayOfMonth(year, month /* 1-indexed */) {
  return new Date(year, month, 0).getDate();
}

function buildCalendarMonthPeriod(year, month /* 0-indexed */) {
  const humanMonth = month + 1;

  return {
    label: `${MONTH_NAMES[month]} ${year}`,
    startYear: year,
    startMonth: month,
    getRange: () => ({
      startDate: toDateString(year, humanMonth, 1),
      endDate: toDateString(year, humanMonth, lastDayOfMonth(year, humanMonth)),
    }),
  };
}

const today = new Date();
const current = { year: today.getFullYear(), month: today.getMonth() };

// Most recent first, same convention as FISCAL_YEAR_PRESETS.
export const PAYROLL_CYCLE_PRESETS = Array.from(
  { length: PAYROLL_PERIODS_BACK + 1 },
  (_, i) => {
    const totalMonths = current.year * 12 + current.month - i;
    return buildCalendarMonthPeriod(Math.floor(totalMonths / 12), ((totalMonths % 12) + 12) % 12);
  },
);

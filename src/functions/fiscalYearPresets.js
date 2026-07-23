// functions/fiscalYearPresets.js
// Fiscal-year (April -> March) presets for FiscalYearFilterBar.
// Plain Date math -- no date library, mirrors dateRangePresets.js's style.

const FISCAL_YEARS_BACK = 11; // + current FY = 6 options; bump if finance needs deeper history.

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// April (0-indexed month 3) onward belongs to the FY starting this calendar
// year; Jan-Mar belongs to the FY that started last calendar year.
function getCurrentFiscalYearStartYear(today = new Date()) {
  const year = today.getFullYear();
  return today.getMonth() >= 3 ? year : year - 1;
}

function buildFiscalYear(startYear) {
  const endYear = startYear + 1;

  return {
    label: `${startYear}-${endYear}`,
    startYear,
    getRange: () => ({
      startDate: toDateString(startYear, 4, 1),
      endDate: toDateString(endYear, 3, 31),
    }),
  };
}

const currentFYStartYear = getCurrentFiscalYearStartYear();

// Most recent first.
export const FISCAL_YEAR_PRESETS = Array.from(
  { length: FISCAL_YEARS_BACK + 1 },
  (_, i) => buildFiscalYear(currentFYStartYear - i),
);

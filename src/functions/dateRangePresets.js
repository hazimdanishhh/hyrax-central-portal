// functions/dateRangePresets.js
// Quick date-range presets for any SearchFilterBar with enableDateRange.
// Plain Date math -- no date library in this repo.

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d) {
  const quarter = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), quarter * 3, 1);
}

function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}

function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31);
}

// Day 0 of the FOLLOWING month/quarter is the last day of this one -- avoids
// hand-tracking each month's real day count (28-31) or leap years.
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function endOfQuarter(d) {
  const quarter = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), quarter * 3 + 3, 0);
}

// "This Month"/"This Quarter" are the FULL period (1st through the last
// day), not to-date -- 2026-09-25, per the user's own call: an in-progress
// period should still be a complete, comparable window, the same reasoning
// "This Year" (full year) already applies here and "YTD" exists as the
// separate to-date option for. Matches get_attendance_dashboard_rpc.sql's
// own default-range fix the same day (full current month, not
// month-to-date, so its previous-period delta compares two complete
// months).
export const DATE_RANGE_PRESETS = [
  {
    label: "This Month",
    getRange: () => {
      const now = new Date();
      return {
        startDate: toDateString(startOfMonth(now)),
        endDate: toDateString(endOfMonth(now)),
      };
    },
  },
  {
    label: "This Quarter",
    getRange: () => {
      const now = new Date();
      return {
        startDate: toDateString(startOfQuarter(now)),
        endDate: toDateString(endOfQuarter(now)),
      };
    },
  },
  {
    label: "This Year",
    getRange: () => {
      const now = new Date();
      return {
        startDate: toDateString(startOfYear(now)),
        endDate: toDateString(endOfYear(now)),
      };
    },
  },
  {
    label: "YTD",
    getRange: () => {
      const now = new Date();
      return {
        startDate: toDateString(startOfYear(now)),
        endDate: toDateString(now),
      };
    },
  },
  // {
  //   label: "Last 90 Days",
  //   getRange: () => {
  //     const now = new Date();
  //     return {
  //       startDate: toDateString(daysAgo(now, 90)),
  //       endDate: toDateString(now),
  //     };
  //   },
  // },
];

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

function daysAgo(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - n);
  return copy;
}

export const DATE_RANGE_PRESETS = [
  {
    label: "This Month",
    getRange: () => {
      const now = new Date();
      return {
        startDate: toDateString(startOfMonth(now)),
        endDate: toDateString(now),
      };
    },
  },
  {
    label: "This Quarter",
    getRange: () => {
      const now = new Date();
      return {
        startDate: toDateString(startOfQuarter(now)),
        endDate: toDateString(now),
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
  {
    label: "Last 90 Days",
    getRange: () => {
      const now = new Date();
      return {
        startDate: toDateString(daysAgo(now, 90)),
        endDate: toDateString(now),
      };
    },
  },
];

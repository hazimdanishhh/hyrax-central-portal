// GroupMask -> financial-statement drawer, confirmed live against Hyrax's
// chart of accounts (see hyrax-data-platform/docs/data-dictionary.md's "GL
// Hierarchy & Sign Convention" section). 9/10 are standard SAP B1 drawer
// slots not named/used in Hyrax's live chart.
export const DRAWER_LABELS = {
  1: "Assets",
  2: "Liabilities",
  3: "Equity",
  4: "Turnover",
  5: "Cost of Sales",
  6: "Expenses",
  7: "Other Expenditure",
  8: "Taxation",
  9: "Unused (9)",
  10: "Unused (10)",
};

export const DRAWER_OPTIONS = Object.entries(DRAWER_LABELS).map(
  ([value, label]) => ({ label, value }),
);

// One distinct color per drawer, for Chart of Accounts' Overview tab (added
// 2026-09) -- a grid of one Per Annum chart per drawer reads faster when
// each card has its own color instead of every bar being the same blue.
// Pulled straight from CHART_PALETTE (chartColors.js) in drawer order, not a
// new palette.
export const DRAWER_CHART_COLORS = {
  1: "#63d795",
  2: "#63a7d7",
  3: "#d7b663",
  4: "#d76363",
  5: "#d79b63",
  6: "#6763d7",
  7: "#a163d7",
  8: "#ac41c7",
};

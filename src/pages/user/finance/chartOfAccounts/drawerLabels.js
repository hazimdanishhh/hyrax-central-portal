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

// features/_shared/monthGrid.js
//
// Shared by Sales Targets/Budgets' drill-in pages. buildMonthDate is the
// ONLY place a target_month/budget_month string is ever constructed for
// those two flows -- day=1 is structural here, never read from a
// user-facing field.
export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function buildMonthDate(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

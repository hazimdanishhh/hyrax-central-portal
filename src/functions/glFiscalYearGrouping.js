/**
 * Fiscal-year (April-March) grouping helpers shared by every Chart of
 * Accounts "Per Annum" chart -- Account Ledger, Category Detail, and the
 * Overview tab all group the same get_account_monthly_summary_rpc.sql output
 * the same way. Extracted once a 3rd consumer needed it (previously
 * duplicated across just the first two -- see CategoryDetail.jsx's former
 * header comment on why it wasn't worth sharing yet at 2 consumers).
 */
export function monthLabel(monthDateStr) {
  return new Date(monthDateStr).toLocaleDateString("en-MY", {
    month: "short",
    year: "numeric",
  });
}

// April (month index 3) onward belongs to the fiscal year starting this
// calendar year -- same April-March rule as fiscalYearPresets.js's own
// getCurrentFiscalYearStartYear, just applied to an arbitrary month instead
// of "today".
export function fiscalYearLabel(monthDateStr) {
  const d = new Date(monthDateStr);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

/**
 * Groups an all-time monthly summary array into fiscal-year totals -- each
 * month's net debit/credit activity is SUMMED into its fiscal year, correct
 * for a flow figure (an expense/revenue account's yearly total); for a
 * balance-sheet account/category (Assets/Liabilities/Equity) this shows the
 * year's own net movement, not a running point-in-time balance.
 */
export function groupByFiscalYear(monthlySummary) {
  const totals = {};

  (monthlySummary || []).forEach((row) => {
    const label = fiscalYearLabel(row.month);
    totals[label] = (totals[label] || 0) + row.balanceMyr;
  });

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, balanceMyr]) => ({
      name,
      balanceMyr: Math.round(balanceMyr),
    }));
}

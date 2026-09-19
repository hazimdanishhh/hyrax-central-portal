// sap_gl_accounts.current_balance_myr is uniformly debit-positive: Assets
// (drawer 1, debit-normal) store positive as-is; Liabilities (2)/Equity
// (3)/Turnover (4) (credit-normal) store NEGATIVE. Cost of Sales (5)/
// Expenses (6)/Other Expenditure (7)/Taxation (8) are debit-normal like
// Assets, so they also store positive as-is. Confirmed live via a
// balance-sheet identity check (Assets + Liabilities + Equity summed to
// within ~RM205K of zero) in get_finance_dashboard_rpc.sql's own
// "Sign convention" comment -- reused verbatim here rather than re-derived,
// so this page's numbers can never quietly drift from the Finance
// dashboard's.
const CREDIT_NORMAL_DRAWERS = new Set([2, 3, 4]);

export function signCorrectedBalance(balance, drawer) {
  const amount = balance || 0;
  return CREDIT_NORMAL_DRAWERS.has(Number(drawer)) ? -amount : amount;
}

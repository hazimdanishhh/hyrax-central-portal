import { signCorrectedBalance } from "./glBalanceSign";

/**
 * Builds a father_code-based tree from the flat sap_gl_accounts list, for
 * Chart of Accounts' hierarchy view. A row whose father_code doesn't
 * resolve to any known account_code (orphaned reference -- a data-quality
 * gap, not expected but not fatal) is treated as its own root rather than
 * silently dropped, matching this app's "never silently drop a row"
 * convention (see e.g. fetchInvoicesForSalesOrder's own comment).
 *
 * Each parent node also gets `rollupBalanceMyr`: the sum of every POSTABLE
 * descendant's sign-corrected balance. Deliberately never reads a
 * non-postable/title row's own current_balance_myr for this -- mirrors
 * get_finance_dashboard_rpc.sql's gl_balance_sheet CTE, which only ever
 * sums postable-account balances grouped by ancestor, never trusts a title
 * account's own stored balance for a rollup.
 */
export function buildAccountHierarchy(accounts) {
  const byCode = new Map();
  accounts.forEach((account) => {
    byCode.set(account.account_code, { ...account, children: [] });
  });

  const roots = [];
  byCode.forEach((node) => {
    const father = node.father_code ? byCode.get(node.father_code) : null;
    if (father) {
      father.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByCode = (a, b) => String(a.account_code).localeCompare(String(b.account_code));
  const sortTree = (nodes) => {
    nodes.sort(sortByCode);
    nodes.forEach((node) => sortTree(node.children));
  };
  sortTree(roots);

  // Own contribution (only if postable -- see header comment) plus every
  // child's rollup, not an if/else on "has children" -- a postable account
  // isn't expected to have children, but this stays correct even if one
  // ever does, rather than silently dropping its own balance.
  function computeRollup(node) {
    const ownContribution =
      node.is_postable === "Y"
        ? signCorrectedBalance(node.current_balance_myr, node.drawer)
        : 0;
    const childrenTotal = node.children.reduce(
      (sum, child) => sum + computeRollup(child),
      0,
    );
    const total = ownContribution + childrenTotal;

    if (node.children.length > 0) node.rollupBalanceMyr = total;
    return total;
  }
  roots.forEach(computeRollup);

  return roots;
}

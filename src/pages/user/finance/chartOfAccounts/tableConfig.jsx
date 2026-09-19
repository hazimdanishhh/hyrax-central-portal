// pages/user/finance/chartOfAccounts/tableConfig.jsx
// Read-only columns -- sap_gl_accounts is a mirror of SAP, not editable here.

import { DRAWER_LABELS } from "./drawerLabels";
import { signCorrectedBalance } from "../../../../functions/glBalanceSign";

export const chartOfAccountsTableConfig = () => [
  {
    key: "drawer",
    label: "Drawer",
    getValue: (row) => DRAWER_LABELS[row.drawer] || row.drawer,
    editable: false,
  },
  {
    key: "account_code",
    label: "Account Code",
    getValue: (row) => row.account_code,
    editable: false,
  },
  {
    key: "account_name",
    label: "Account Name",
    getValue: (row) => row.account_name,
    editable: false,
  },
  // {
  //   key: "father_code",
  //   label: "Father Code",
  //   getValue: (row) => row.father_code || "—",
  //   editable: false,
  // },
  // {
  //   key: "level",
  //   label: "Level",
  //   getValue: (row) => row.level,
  //   editable: false,
  // },
  // {
  //   key: "is_postable",
  //   label: "Postable",
  //   getValue: (row) => (row.is_postable === "Y" ? "Yes" : "No"),
  //   editable: false,
  // },
  {
    key: "current_balance_myr",
    label: "Current Balance (RM)",
    // Sign-corrected -- current_balance_myr is stored debit-positive, so a
    // Liability/Equity/Revenue account's raw value is negative (see
    // glBalanceSign.js). A summary/title account's own current_balance_myr
    // is never meaningful (see get_finance_dashboard_rpc.sql's
    // gl_balance_sheet CTE, which never trusts it either) -- `—` unless the
    // hierarchy tree view has attached a real rollupBalanceMyr (see
    // buildAccountHierarchy.js), in which case that rolled-up total from its
    // postable descendants is shown instead.
    getValue: (row) => {
      if (row.is_postable === "Y") {
        return `RM ${Math.round(signCorrectedBalance(row.current_balance_myr, row.drawer)).toLocaleString()}`;
      }
      return row.rollupBalanceMyr != null
        ? `RM ${Math.round(row.rollupBalanceMyr).toLocaleString()}`
        : "—";
    },
    editable: false,
  },
];

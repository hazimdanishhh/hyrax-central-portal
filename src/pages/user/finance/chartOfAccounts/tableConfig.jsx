// pages/user/finance/chartOfAccounts/tableConfig.jsx
// Read-only columns -- sap_gl_accounts is a mirror of SAP, not editable here.

import { DRAWER_LABELS } from "./drawerLabels";

export const chartOfAccountsTableConfig = () => [
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
  {
    key: "drawer",
    label: "Drawer",
    getValue: (row) => DRAWER_LABELS[row.drawer] || row.drawer,
    editable: false,
  },
  {
    key: "father_code",
    label: "Father Code",
    getValue: (row) => row.father_code || "—",
    editable: false,
  },
  {
    key: "level",
    label: "Level",
    getValue: (row) => row.level,
    editable: false,
  },
  {
    key: "is_postable",
    label: "Postable",
    getValue: (row) => (row.is_postable === "Y" ? "Yes" : "No"),
    editable: false,
  },
  {
    key: "current_balance_myr",
    label: "Current Balance (RM)",
    // Not meaningful for summary/title accounts (is_postable = 'N') --
    // see gl_migration.sql's own comment on this column.
    getValue: (row) =>
      row.is_postable === "Y"
        ? `RM ${Math.round(row.current_balance_myr || 0).toLocaleString()}`
        : "—",
    editable: false,
  },
];

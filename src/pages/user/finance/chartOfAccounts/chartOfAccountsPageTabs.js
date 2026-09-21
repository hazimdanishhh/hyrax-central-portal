// src/pages/user/finance/chartOfAccounts/chartOfAccountsPageTabs.js
//
// Single source of truth for the "Chart of Accounts" page-tab bar
// (ChartOfAccountsPageLayout.jsx) and its nested sidenav sub-links (the
// "Chart of Accounts" link's `tabs` field in src/data/sideNavLinkData.js).
// Both tabs share the parent link's own gate (departments: ["FIN","MGM"]),
// matching Invoices'/Bills' own tabs arrays.
import { TreeStructureIcon, ChartBarIcon } from "@phosphor-icons/react";

export const chartOfAccountsPageTabs = [
  { label: "List", icon: TreeStructureIcon, path: "list" },
  { label: "Overview", icon: ChartBarIcon, path: "overview" },
];

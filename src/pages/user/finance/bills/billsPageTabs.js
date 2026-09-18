// src/pages/user/finance/bills/billsPageTabs.js
//
// Single source of truth for the "Bills & A/P" page-tab bar
// (BillsPageLayout.jsx) and its nested sidenav sub-links (the "Bills & A/P"
// link's `tabs` field in src/data/sideNavLinkData.js). Both tabs share the
// parent link's own gate (departments: ["FIN","MGM"]), matching
// list/vendor-payments' AccessRoute in FinanceRoutes.jsx exactly.
import { ListIcon, HandCoinsIcon } from "@phosphor-icons/react";

export const billsPageTabs = [
  { label: "Bills", icon: ListIcon, path: "list" },
  { label: "Payments", icon: HandCoinsIcon, path: "vendor-payments" },
];

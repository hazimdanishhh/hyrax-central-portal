// src/pages/user/finance/invoices/invoicesPageTabs.js
//
// Single source of truth for the "Invoices & A/R" page-tab bar
// (InvoicesPageLayout.jsx) and its nested sidenav sub-links (the "Invoices
// & A/R" link's `tabs` field in src/data/sideNavLinkData.js). Both tabs
// share the parent link's own gate (departments: ["FIN","MGM"]), matching
// list/payments' AccessRoute in FinanceRoutes.jsx exactly.
import { ListIcon, CoinsIcon } from "@phosphor-icons/react";

export const invoicesPageTabs = [
  { label: "Invoices", icon: ListIcon, path: "list" },
  { label: "Payments", icon: CoinsIcon, path: "payments" },
];

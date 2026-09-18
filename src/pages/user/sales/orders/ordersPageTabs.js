// src/pages/user/sales/orders/ordersPageTabs.js
//
// Single source of truth for the Sales Orders page-tab bar
// (OrdersPageLayout.jsx) and its nested sidenav sub-links (the "Sales
// Orders" link's `tabs` field in src/data/sideNavLinkData.js). Each tab's
// roles/departments must match its own AccessRoute in SalesRoutes.jsx.
import { ListIcon, WalletIcon } from "@phosphor-icons/react";

export const ordersPageTabs = [
  { label: "All Orders", icon: ListIcon, path: "all" },
  {
    label: "Budgets",
    icon: WalletIcon,
    path: "budgets",
    // Mirrors orders/budgets' <AccessRoute departments={["SAL","MGM"]} roles={["manager"]}>
    departments: ["SAL", "MGM"],
    roles: ["manager"],
  },
];

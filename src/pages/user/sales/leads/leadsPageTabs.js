// src/pages/user/sales/leads/leadsPageTabs.js
//
// Single source of truth for the Leads Pipeline page-tab bar
// (LeadsPageLayout.jsx) and its nested sidenav sub-links (the "Leads
// Pipeline" link's `tabs` field in src/data/sideNavLinkData.js). Each tab's
// roles/departments must match its own AccessRoute in SalesRoutes.jsx.
import {
  ChartLineIcon,
  ListIcon,
  CrosshairSimpleIcon,
} from "@phosphor-icons/react";

export const leadsPageTabs = [
  { label: "Overview", icon: ChartLineIcon, path: "overview" },
  { label: "All Leads", icon: ListIcon, path: "list" },
  {
    label: "Targets",
    icon: CrosshairSimpleIcon,
    path: "targets",
    // Mirrors leads/targets' <AccessRoute departments={["SAL","MGM"]} roles={["manager"]}>
    departments: ["SAL", "MGM"],
    roles: ["manager"],
  },
];

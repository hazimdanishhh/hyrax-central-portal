// src/pages/user/sales/reports/salesReportsTabs.js
//
// Single source of truth for the Sales Reports tab bar (SalesReportsLayout)
// and its sidenav sub-links (the "Reports" link's `tabs` in
// src/data/sideNavLinkData.js) -- same pattern as leadsPageTabs.js.
// Plan: docs/sales/SALES-REPORTS-TABS-PLAN.md §2-§3.
import {
  ChartBarIcon,
  FileTextIcon,
  FunnelIcon,
  ReceiptIcon,
  TrendUpIcon,
  UsersThreeIcon,
  WalletIcon,
} from "@phosphor-icons/react";

export const salesReportsTabs = [
  // The funnel, left to right: Pipeline (CRM) -> Orders (bookings) ->
  // Invoicing (billings) -> Collections (cash). Summary heads it; Team and
  // Forecast follow.
  { label: "Summary", icon: ChartBarIcon, path: "summary" },
  { label: "Pipeline", icon: FunnelIcon, path: "pipeline" },
  { label: "Orders", icon: FileTextIcon, path: "orders" },
  { label: "Invoicing", icon: ReceiptIcon, path: "invoicing" },
  { label: "Collections", icon: WalletIcon, path: "collections" },
  { label: "Team", icon: UsersThreeIcon, path: "team" },
  { label: "Forecast", icon: TrendUpIcon, path: "forecast" },
];

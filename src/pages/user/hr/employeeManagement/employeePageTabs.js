// src/pages/user/hr/employeeManagement/employeePageTabs.js
//
// Single source of truth for the Employee Management page-tab bar
// (EmployeePageLayout.jsx) and its nested sidenav sub-links (the "Employee
// Management" link's `tabs` field in src/data/sideNavLinkData.js). Both tabs
// share the parent link's own gate (departments: ["HR"]), matching
// overview/list's AccessRoute in HRRoutes.jsx exactly. A "Settings" tab
// exists commented out in EmployeePageLayout.jsx -- add it here once it
// actually ships.
import { ChartLineIcon, ListIcon } from "@phosphor-icons/react";

export const employeePageTabs = [
  { label: "Overview", icon: ChartLineIcon, path: "overview" },
  { label: "Employees List", icon: ListIcon, path: "list" },
];

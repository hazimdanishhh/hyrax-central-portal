// src/pages/user/employee/teamAttendance/teamAttendancePageTabs.js
//
// Single source of truth for the Team Attendance page-tab bar
// (TeamAttendancePageLayout.jsx) and its nested sidenav sub-links (the
// "Team Attendance" link's `tabs` field in src/data/sideNavLinkData.js).
// Both tabs share the parent link's own gate (roles: ["manager"]), matching
// overview/list's AccessRoute in EmployeeRoutes.jsx exactly, so neither
// needs its own roles here.
import { ChartLineIcon, ListIcon } from "@phosphor-icons/react";

export const teamAttendancePageTabs = [
  { label: "Overview", icon: ChartLineIcon, path: "overview" },
  { label: "Attendance List", icon: ListIcon, path: "list" },
];

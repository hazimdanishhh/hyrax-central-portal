// src/pages/user/employee/attendance/attendancePageTabs.js
//
// Single source of truth for the My Attendance page-tab bar
// (AttendancePageLayout.jsx) and its nested sidenav sub-links (the "My
// Attendance" link's `tabs` field in src/data/sideNavLinkData.js). Both
// tabs are universal (R2, no AccessRoute in EmployeeRoutes.jsx), matching
// the sidenav link's own lack of a gate.
import { ChartLineIcon, ListIcon } from "@phosphor-icons/react";

export const attendancePageTabs = [
  { label: "Overview", icon: ChartLineIcon, path: "overview" },
  { label: "Attendance History", icon: ListIcon, path: "list" },
];

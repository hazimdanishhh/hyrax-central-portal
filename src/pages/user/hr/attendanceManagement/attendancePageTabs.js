// src/pages/user/hr/attendanceManagement/attendancePageTabs.js
//
// Single source of truth for the Attendance Management page-tab bar
// (AttendancePageLayout.jsx) and its nested sidenav sub-links (the
// "Attendance Management" link's `tabs` field in
// src/data/sideNavLinkData.js). Each tab's roles/departments must match its
// own AccessRoute in HRRoutes.jsx.
import {
  ChartLineIcon,
  ListIcon,
  CalendarIcon,
  CurrencyCircleDollarIcon,
} from "@phosphor-icons/react";

export const attendancePageTabs = [
  { label: "Overview", icon: ChartLineIcon, path: "overview" },
  { label: "Attendance List", icon: ListIcon, path: "list" },
  // Labeled "Holidays" (not "Settings") so HR staff immediately recognize
  // this tab as the public holiday / company off-day calendar -- see
  // AttendanceSettings.jsx's own header comment; route path stays
  // "settings" (unchanged) to avoid touching HRRoutes.jsx/bookmarks.
  { label: "Holidays", icon: CalendarIcon, path: "settings" },
  {
    label: "Payroll Export",
    icon: CurrencyCircleDollarIcon,
    path: "payroll-export",
  },
];

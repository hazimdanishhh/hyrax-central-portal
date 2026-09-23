// src/pages/user/hr/leaveManagement/leaveManagementPageTabs.js
//
// Single source of truth for the Leave Management page-tab bar
// (LeaveManagementPageLayout.jsx) and its nested sidenav sub-links (the
// "Leave Management" link's `tabs` field in src/data/sideNavLinkData.js).
// Each tab's roles/departments must match its own AccessRoute in
// HRRoutes.jsx -- here both inherit the parent link's HR gate, so neither
// needs its own.
//
// Leave Management was a single untabbed page until 2026-09-23. The second
// tab exists because the leave sync now AUTO-CREATES unknown leave type
// codes rather than rejecting the whole upload -- and an auto-created type
// defaults to PAID with needs_hr_confirmation set, so there has to be
// somewhere HR can see what was created and correct it. Without this tab
// that default would silently misreport paid vs unpaid leave to payroll.
import { ListIcon, TagIcon } from "@phosphor-icons/react";

export const leaveManagementPageTabs = [
  { label: "Leave Records", icon: ListIcon, path: "records" },
  { label: "Leave Types", icon: TagIcon, path: "types" },
];

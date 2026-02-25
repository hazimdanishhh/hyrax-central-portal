// src/data/sideNavLinkData.js
import {
  HouseIcon,
  UserCircleIcon,
  SquaresFourIcon,
  ListDashesIcon,
  FoldersIcon,
  UsersIcon,
  UserPlusIcon,
  ChartBarIcon,
  HandshakeIcon,
  CoinsIcon,
  FileTextIcon,
  ClipboardTextIcon,
  GearIcon,
  BellIcon,
  CalendarIcon,
  BriefcaseIcon,
  GaugeIcon,
  MegaphoneIcon,
  QuestionIcon,
  AddressBookIcon,
  WalletIcon,
  FilesIcon,
  UsersThreeIcon,
  UsersFourIcon,
  ComputerTowerIcon,
  BookBookmarkIcon,
} from "@phosphor-icons/react";

// =============================
// Reusable Segment Templates
// =============================

// 🧭 COMMON — accessible to everyone
const commonSegment = {
  segmentTitle: null,
  segmentCode: null,
  links: [
    { label: "Dashboard", icon: HouseIcon, path: "" },
    { label: "Announcements", icon: MegaphoneIcon, path: "announcements" },
    { label: "Notifications", icon: BellIcon, path: "notifications" },
    { label: "Profile", icon: UserCircleIcon, path: "profile" },
    { label: "Department", icon: UsersThreeIcon, path: "department" },
    { label: "Employees", icon: UsersFourIcon, path: "employees" },
  ],
};

// 💼 WORKSPACE — universal collaboration tools
const workspaceSegment = {
  segmentTitle: "WORKSPACE",
  segmentCode: "SPACE",
  links: [
    { label: "Projects", icon: SquaresFourIcon, path: "workspace/projects" },
    { label: "Tasks", icon: ListDashesIcon, path: "workspace/tasks" },
    { label: "Documents", icon: FoldersIcon, path: "workspace/documents" },
  ],
};

// 💰 SALES — for Business Development & Sales
const salesSegment = {
  segmentTitle: "SALES",
  segmentCode: "SALES",
  links: [
    {
      label: "Opportunities",
      icon: HandshakeIcon,
      path: "sales/opportunities",
    },
    { label: "Clients", icon: UsersIcon, path: "sales/clients" },
    { label: "Quotations", icon: FileTextIcon, path: "sales/quotations" },
    { label: "Reports", icon: ChartBarIcon, path: "sales/reports" },
  ],
};

// 💵 FINANCE — for Finance & Accounting
const financeSegment = {
  segmentTitle: "FINANCE",
  segmentCode: "FINANCE",
  links: [
    { label: "Invoices", icon: FileTextIcon, path: "finance/invoices" },
    // { label: "Payments", icon: CoinsIcon, path: "finance/payments" },
    {
      label: "Claims Management",
      icon: ClipboardTextIcon,
      path: "finance/claims-management",
    },
    { label: "Reports", icon: ChartBarIcon, path: "finance/reports" },
  ],
};

// 👥 HR — for Human Resources
const hrSegment = {
  segmentTitle: "HUMAN RESOURCES",
  segmentCode: "HR",
  links: [
    { label: "Overview", icon: ChartBarIcon, path: "hr/overview" },
    { label: "Employee Management", icon: UsersFourIcon, path: "hr/employees" },
    {
      label: "Department Management",
      icon: UsersThreeIcon,
      path: "hr/departments",
    },
    {
      label: "Onboarding Management",
      icon: AddressBookIcon,
      path: "hr/onboarding",
    },
    {
      label: "Attendance Management",
      icon: ClipboardTextIcon,
      path: "hr/attendance",
    },
    { label: "Leave Management", icon: CalendarIcon, path: "hr/leaves" },
    { label: "Recruitment", icon: BriefcaseIcon, path: "hr/recruitment" },
    { label: "Claims Management", icon: WalletIcon, path: "hr/claims" },
    { label: "Policy Management", icon: FilesIcon, path: "hr/policies" },
    { label: "Forms & Templates", icon: FilesIcon, path: "hr/forms" },
    {
      label: "Performance Management",
      icon: GaugeIcon,
      path: "hr/performance",
    },
    {
      label: "Training & Development",
      icon: BookBookmarkIcon,
      path: "hr/training",
    },
  ],
};

// 🧾 EMPLOYEE — for every non-admin staff
const employeeSegment = {
  segmentTitle: "EMPLOYEE",
  segmentCode: "EMPLOYEE",
  links: [
    { label: "Onboarding", icon: AddressBookIcon, path: "employee/onboarding" },
    {
      label: "Attendance",
      icon: ClipboardTextIcon,
      path: "employee/attendance",
    },
    {
      label: "Leave Request",
      icon: CalendarIcon,
      path: "employee/leave-request",
    },
    { label: "Claims", icon: WalletIcon, path: "employee/claims" },
    { label: "Policies", icon: FilesIcon, path: "employee/policies" },
    { label: "Forms & Templates", icon: FilesIcon, path: "employee/forms" },
    {
      label: "Performance Review",
      icon: GaugeIcon,
      path: "employee/performance",
    },
    {
      label: "Training & Development",
      icon: BookBookmarkIcon,
      path: "employee/training",
    },
  ],
};

// INFORMATION TECHNOLOGY
const itSegment = {
  segmentTitle: "IT",
  segmentCode: "IT",
  links: [{ label: "IT Assets", icon: ComputerTowerIcon, path: "it/assets" }],
};

// SUPPORT
const supportSegment = {
  segmentTitle: null,
  segmentCode: null,
  links: [{ label: "Help & Support", icon: QuestionIcon, path: "help" }],
};

// ⚙️ ADMIN — full control over system management
const adminSegment = {
  segmentTitle: "SYSTEM",
  links: [
    { label: "Users", icon: UsersIcon, path: "system/users" },
    { label: "Roles & Permissions", icon: GearIcon, path: "admin/roles" },
    { label: "Audit Logs", icon: FileTextIcon, path: "admin/audit-logs" },
    { label: "System Settings", icon: GearIcon, path: "admin/settings" },
  ],
};

// =============================
// Department-based Structure
// =============================

export const sideNavLinkData = {
  // Default users (no specific department)
  GEN: [commonSegment, workspaceSegment, employeeSegment, supportSegment],

  // Business Development & Sales
  BDS: [
    commonSegment,
    workspaceSegment,
    salesSegment,
    employeeSegment,
    supportSegment,
  ],

  // Finance & Accounting
  FIN: [
    commonSegment,
    workspaceSegment,
    financeSegment,
    employeeSegment,
    supportSegment,
  ],

  // Corporate Communications (optional future expansion)
  COM: [commonSegment, workspaceSegment, employeeSegment, supportSegment],

  // Human Resources
  HR: [
    commonSegment,
    workspaceSegment,
    hrSegment,
    employeeSegment,
    supportSegment,
  ],

  // Admin override (has full system control)
  superadmin: [
    commonSegment,
    workspaceSegment,
    adminSegment,
    itSegment,
    salesSegment,
    financeSegment,
    employeeSegment,
    hrSegment,
    supportSegment,
  ],
};

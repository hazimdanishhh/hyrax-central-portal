// src/data/sideNavLinkData.js
import {
  House,
  UserCircle,
  SquaresFour,
  ListDashes,
  Folders,
  Users,
  UserPlus,
  ChartBar,
  Handshake,
  Coins,
  FileText,
  ClipboardText,
  Gear,
  Bell,
  Calendar,
  Briefcase,
  Gauge,
  Megaphone,
  Question,
  AddressBook,
  Wallet,
  Files,
  UsersThree,
  UsersFour,
  ComputerTower,
  BookBookmark,
} from "phosphor-react";

// =============================
// Reusable Segment Templates
// =============================

// 🧭 COMMON — accessible to everyone
const commonSegment = {
  segmentTitle: null,
  segmentCode: null,
  links: [
    { label: "Dashboard", icon: House, path: "" },
    { label: "Announcements", icon: Megaphone, path: "announcements" },
    { label: "Notifications", icon: Bell, path: "notifications" },
    { label: "Profile", icon: UserCircle, path: "profile" },
    { label: "Department", icon: UsersThree, path: "department" },
    { label: "Employees", icon: UsersFour, path: "employees" },
  ],
};

// 💼 WORKSPACE — universal collaboration tools
const workspaceSegment = {
  segmentTitle: "WORKSPACE",
  segmentCode: "SPACE",
  links: [
    { label: "Projects", icon: SquaresFour, path: "workspace/projects" },
    { label: "Tasks", icon: ListDashes, path: "workspace/tasks" },
    { label: "Documents", icon: Folders, path: "workspace/documents" },
  ],
};

// 💰 SALES — for Business Development & Sales
const salesSegment = {
  segmentTitle: "SALES",
  segmentCode: "SALES",
  links: [
    { label: "Opportunities", icon: Handshake, path: "sales/opportunities" },
    { label: "Clients", icon: Users, path: "sales/clients" },
    { label: "Quotations", icon: FileText, path: "sales/quotations" },
    { label: "Reports", icon: ChartBar, path: "sales/reports" },
  ],
};

// 💵 FINANCE — for Finance & Accounting
const financeSegment = {
  segmentTitle: "FINANCE",
  segmentCode: "FINANCE",
  links: [
    { label: "Invoices", icon: FileText, path: "finance/invoices" },
    // { label: "Payments", icon: Coins, path: "finance/payments" },
    {
      label: "Claims Management",
      icon: ClipboardText,
      path: "finance/claims-management",
    },
    { label: "Reports", icon: ChartBar, path: "finance/reports" },
  ],
};

// 👥 HR — for Human Resources
const hrSegment = {
  segmentTitle: "HUMAN RESOURCES",
  segmentCode: "HR",
  links: [
    { label: "Overview", icon: ChartBar, path: "hr/overview" },
    { label: "Employee Management", icon: UsersFour, path: "hr/employees" },
    {
      label: "Department Management",
      icon: UsersThree,
      path: "hr/departments",
    },
    {
      label: "Onboarding Management",
      icon: AddressBook,
      path: "hr/onboarding",
    },
    {
      label: "Attendance Management",
      icon: ClipboardText,
      path: "hr/attendance",
    },
    { label: "Leave Management", icon: Calendar, path: "hr/leaves" },
    { label: "Recruitment", icon: Briefcase, path: "hr/recruitment" },
    { label: "Claims Management", icon: Wallet, path: "hr/claims" },
    { label: "Policy Management", icon: Files, path: "hr/policies" },
    { label: "Forms & Templates", icon: Files, path: "hr/forms" },
    { label: "Performance Management", icon: Gauge, path: "hr/performance" },
    {
      label: "Training & Development",
      icon: BookBookmark,
      path: "hr/training",
    },
  ],
};

// 🧾 EMPLOYEE — for every non-admin staff
const employeeSegment = {
  segmentTitle: "EMPLOYEE",
  segmentCode: "EMPLOYEE",
  links: [
    { label: "Onboarding", icon: AddressBook, path: "employee/onboarding" },
    { label: "Attendance", icon: ClipboardText, path: "employee/attendance" },
    { label: "Leave Request", icon: Calendar, path: "employee/leave-request" },
    { label: "Claims", icon: Wallet, path: "employee/claims" },
    { label: "Policies", icon: Files, path: "employee/policies" },
    { label: "Forms & Templates", icon: Files, path: "employee/forms" },
    { label: "Performance Review", icon: Gauge, path: "employee/performance" },
    {
      label: "Training & Development",
      icon: BookBookmark,
      path: "employee/training",
    },
  ],
};

// INFORMATION TECHNOLOGY
const itSegment = {
  segmentTitle: "IT",
  segmentCode: "IT",
  links: [{ label: "IT Assets", icon: ComputerTower, path: "it/assets" }],
};

// SUPPORT
const supportSegment = {
  segmentTitle: null,
  segmentCode: null,
  links: [{ label: "Help & Support", icon: Question, path: "help" }],
};

// ⚙️ ADMIN — full control over system management
const adminSegment = {
  segmentTitle: "SYSTEM",
  links: [
    { label: "Users", icon: Users, path: "system/users" },
    { label: "Roles & Permissions", icon: Gear, path: "admin/roles" },
    { label: "Audit Logs", icon: FileText, path: "admin/audit-logs" },
    { label: "System Settings", icon: Gear, path: "admin/settings" },
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

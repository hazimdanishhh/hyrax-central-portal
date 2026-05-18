// src/data/sideNavLinkData.js
// import {
//   HouseIcon,
//   UserCircleIcon,
//   SquaresFourIcon,
//   ListDashesIcon,
//   FoldersIcon,
//   UsersIcon,
//   UserPlusIcon,
//   ChartBarIcon,
//   HandshakeIcon,
//   CoinsIcon,
//   FileTextIcon,
//   ClipboardTextIcon,
//   GearIcon,
//   BellIcon,
//   CalendarIcon,
//   BriefcaseIcon,
//   GaugeIcon,
//   MegaphoneIcon,
//   QuestionIcon,
//   AddressBookIcon,
//   WalletIcon,
//   FilesIcon,
//   UsersThreeIcon,
//   UsersFourIcon,
//   ComputerTowerIcon,
//   BookBookmarkIcon,
//   AppWindowIcon,
//   MonitorIcon,
// } from "@phosphor-icons/react";

// =============================
// Reusable Segment Templates
// =============================

// 🧭 COMMON — accessible to everyone
// const commonSegment = {
//   segmentTitle: null,
//   segmentCode: null,
//   links: [
//     { label: "Dashboard", icon: HouseIcon, path: "" },
//     { label: "Announcements", icon: MegaphoneIcon, path: "announcements" },
//     { label: "Notifications", icon: BellIcon, path: "notifications" },
//     { label: "Profile", icon: UserCircleIcon, path: "profile" },
//     { label: "Department", icon: UsersThreeIcon, path: "department" },
//     { label: "Employees", icon: UsersFourIcon, path: "employees" },
//   ],
// };

// // 💼 WORKSPACE — universal collaboration tools
// const workspaceSegment = {
//   segmentTitle: "WORKSPACE",
//   segmentCode: "SPACE",
//   links: [
//     { label: "Projects", icon: SquaresFourIcon, path: "workspace/projects" },
//     { label: "Tasks", icon: ListDashesIcon, path: "workspace/tasks" },
//     { label: "Documents", icon: FoldersIcon, path: "workspace/documents" },
//   ],
// };

// // 💰 SALES — for Business Development & Sales
// const salesSegment = {
//   segmentTitle: "SALES",
//   segmentCode: "SALES",
//   links: [
//     {
//       label: "Opportunities",
//       icon: HandshakeIcon,
//       path: "sales/opportunities",
//     },
//     { label: "Clients", icon: UsersIcon, path: "sales/clients" },
//     { label: "Quotations", icon: FileTextIcon, path: "sales/quotations" },
//     { label: "Reports", icon: ChartBarIcon, path: "sales/reports" },
//   ],
// };

// // 💵 FINANCE — for Finance & Accounting
// const financeSegment = {
//   segmentTitle: "FINANCE",
//   segmentCode: "FINANCE",
//   links: [
//     { label: "Invoices", icon: FileTextIcon, path: "finance/invoices" },
//     // { label: "Payments", icon: CoinsIcon, path: "finance/payments" },
//     {
//       label: "Claims Management",
//       icon: ClipboardTextIcon,
//       path: "finance/claims-management",
//     },
//     { label: "Reports", icon: ChartBarIcon, path: "finance/reports" },
//   ],
// };

// // 👥 HR — for Human Resources
// const hrSegment = {
//   segmentTitle: "HUMAN RESOURCES",
//   segmentCode: "HR",
//   links: [
//     { label: "Overview", icon: ChartBarIcon, path: "hr/overview" },
//     { label: "Employee Management", icon: UsersFourIcon, path: "hr/employees" },
//     {
//       label: "Department Management",
//       icon: UsersThreeIcon,
//       path: "hr/departments",
//     },
//     {
//       label: "Onboarding Management",
//       icon: AddressBookIcon,
//       path: "hr/onboarding",
//     },
//     {
//       label: "Attendance Management",
//       icon: ClipboardTextIcon,
//       path: "hr/attendance",
//     },
//     { label: "Leave Management", icon: CalendarIcon, path: "hr/leaves" },
//     { label: "Recruitment", icon: BriefcaseIcon, path: "hr/recruitment" },
//     { label: "Claims Management", icon: WalletIcon, path: "hr/claims" },
//     { label: "Policy Management", icon: FilesIcon, path: "hr/policies" },
//     { label: "Forms & Templates", icon: FilesIcon, path: "hr/forms" },
//     {
//       label: "Performance Management",
//       icon: GaugeIcon,
//       path: "hr/performance",
//     },
//     {
//       label: "Training & Development",
//       icon: BookBookmarkIcon,
//       path: "hr/training",
//     },
//   ],
// };

// // 🧾 EMPLOYEE — for every non-admin staff
// const employeeSegment = {
//   segmentTitle: "EMPLOYEE",
//   segmentCode: "EMPLOYEE",
//   links: [
//     { label: "Onboarding", icon: AddressBookIcon, path: "employee/onboarding" },
//     {
//       label: "Attendance",
//       icon: ClipboardTextIcon,
//       path: "employee/attendance",
//     },
//     {
//       label: "Leave Request",
//       icon: CalendarIcon,
//       path: "employee/leave-request",
//     },
//     { label: "Claims", icon: WalletIcon, path: "employee/claims" },
//     { label: "Policies", icon: FilesIcon, path: "employee/policies" },
//     { label: "Forms & Templates", icon: FilesIcon, path: "employee/forms" },
//     {
//       label: "Performance Review",
//       icon: GaugeIcon,
//       path: "employee/performance",
//     },
//     {
//       label: "Training & Development",
//       icon: BookBookmarkIcon,
//       path: "employee/training",
//     },
//   ],
// };

// // INFORMATION TECHNOLOGY
// const itSegment = {
//   segmentTitle: "IT",
//   segmentCode: "IT",
//   links: [
//     { label: "Dashboard", icon: SquaresFourIcon, path: "it/dashboard" },
//     { label: "IT Assets", icon: MonitorIcon, path: "it/assets" },
//     { label: "Software", icon: AppWindowIcon, path: "it/software" },
//   ],
// };

// // SUPPORT
// const supportSegment = {
//   segmentTitle: null,
//   segmentCode: null,
//   links: [{ label: "Help & Support", icon: QuestionIcon, path: "help" }],
// };

// // ⚙️ ADMIN — full control over system management
// const adminSegment = {
//   segmentTitle: "SYSTEM",
//   links: [
//     { label: "Users", icon: UsersIcon, path: "system/users" },
//     { label: "Roles & Permissions", icon: GearIcon, path: "admin/roles" },
//     { label: "Audit Logs", icon: FileTextIcon, path: "admin/audit-logs" },
//     { label: "System Settings", icon: GearIcon, path: "admin/settings" },
//   ],
// };

// // =============================
// // Department-based Structure
// // =============================

// export const sideNavLinkData = {
//   // Default users (no specific department)
//   GEN: [commonSegment, workspaceSegment, employeeSegment, supportSegment],

//   // Business Development & Sales
//   BDS: [
//     commonSegment,
//     workspaceSegment,
//     salesSegment,
//     employeeSegment,
//     supportSegment,
//   ],

//   // Finance & Accounting
//   FIN: [
//     commonSegment,
//     workspaceSegment,
//     financeSegment,
//     employeeSegment,
//     supportSegment,
//   ],

//   // Corporate Communications (optional future expansion)
//   COM: [commonSegment, workspaceSegment, employeeSegment, supportSegment],

//   // Human Resources
//   HR: [
//     commonSegment,
//     workspaceSegment,
//     hrSegment,
//     employeeSegment,
//     supportSegment,
//   ],

//   // Admin override (has full system control)
//   superadmin: [
//     commonSegment,
//     workspaceSegment,
//     adminSegment,
//     itSegment,
//     salesSegment,
//     financeSegment,
//     employeeSegment,
//     hrSegment,
//     supportSegment,
//   ],
// };

// src/data/sideNavLinkData.js

import {
  HouseIcon,
  UserCircleIcon,
  SquaresFourIcon,
  ListDashesIcon,
  FoldersIcon,
  UsersIcon,
  ChartBarIcon,
  HandshakeIcon,
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
  BookBookmarkIcon,
  AppWindowIcon,
  MonitorIcon,
  CoinsIcon,
} from "@phosphor-icons/react";

export const sideNavLinkData = [
  // =================================================
  // COMMON
  // =================================================
  {
    segmentTitle: null,
    segmentCode: null,

    links: [
      {
        label: "Dashboard",
        icon: HouseIcon,
        path: "",
      },

      {
        label: "Announcements",
        icon: MegaphoneIcon,
        path: "announcements",
      },

      {
        label: "Notifications",
        icon: BellIcon,
        path: "notifications",
      },

      {
        label: "Profile",
        icon: UserCircleIcon,
        path: "profile",
      },

      {
        label: "Department",
        icon: UsersThreeIcon,
        path: "department",
      },

      {
        label: "Employees",
        icon: UsersFourIcon,
        path: "employees",
      },
    ],
  },

  // =================================================
  // WORKSPACE
  // =================================================
  {
    segmentTitle: "WORKSPACE",
    segmentCode: "SPACE",

    links: [
      {
        label: "Projects",
        icon: SquaresFourIcon,
        path: "workspace/projects",
      },

      {
        label: "Tasks",
        icon: ListDashesIcon,
        path: "workspace/tasks",
      },

      {
        label: "Documents",
        icon: FoldersIcon,
        path: "workspace/documents",
      },
    ],
  },

  // =================================================
  // EMPLOYEE
  // =================================================
  {
    segmentTitle: "EMPLOYEE",
    segmentCode: "EMPLOYEE",

    links: [
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

      {
        label: "Claims",
        icon: WalletIcon,
        path: "employee/claims",
      },
    ],
  },

  // =================================================
  // SALES
  // =================================================
  {
    segmentTitle: "SALES",
    segmentCode: "SALES",

    links: [
      {
        label: "Reports",
        icon: ChartBarIcon,
        path: "sales/reports",

        departments: ["SAL"],
        roles: ["manager"],
      },
      {
        label: "Leads",
        icon: HandshakeIcon,
        path: "sales/leads/list",

        departments: ["SAL"],
      },

      {
        label: "Clients",
        icon: UsersIcon,
        path: "sales/clients",

        departments: ["SAL"],
      },

      {
        label: "Quotations",
        icon: FileTextIcon,
        path: "sales/quotations",

        departments: ["SAL"],
      },
    ],
  },

  // =================================================
  // FINANCE
  // =================================================
  {
    segmentTitle: "FINANCE",
    segmentCode: "FINANCE",

    links: [
      {
        label: "Reports",
        icon: ChartBarIcon,
        path: "finance/reports",

        departments: ["FIN"],
        roles: ["manager"],
      },

      {
        label: "Invoices",
        icon: FileTextIcon,
        path: "finance/invoices",

        departments: ["FIN"],
      },

      {
        label: "Claims Management",
        icon: ClipboardTextIcon,
        path: "finance/claims-management",

        departments: ["FIN"],
      },

      {
        label: "Payments",
        icon: CoinsIcon,
        path: "finance/payments",
        departments: ["FIN"],
      },
    ],
  },

  // =================================================
  // HR
  // =================================================
  {
    segmentTitle: "HUMAN RESOURCES",
    segmentCode: "HR",

    links: [
      {
        label: "Overview",
        icon: ChartBarIcon,
        path: "hr/overview",
        departments: ["HR"],
      },

      {
        label: "Employee Management",
        icon: UsersFourIcon,
        path: "hr/employees",

        departments: ["HR"],
      },

      {
        label: "Department Management",
        icon: UsersThreeIcon,
        path: "hr/departments",

        departments: ["HR"],
        roles: ["manager"],
      },

      {
        label: "Attendance Management",
        icon: ClipboardTextIcon,
        path: "hr/attendance",

        departments: ["HR"],
      },

      {
        label: "Leave Management",
        icon: CalendarIcon,
        path: "hr/leaves",

        departments: ["HR"],
      },

      {
        label: "Recruitment",
        icon: BriefcaseIcon,
        path: "hr/recruitment",

        departments: ["HR"],
        roles: ["manager"],
      },

      {
        label: "Onboarding Management",
        icon: AddressBookIcon,
        path: "hr/onboarding",
        departments: ["HR"],
      },
      {
        label: "Policy Management",
        icon: FilesIcon,
        path: "hr/policies",
        departments: ["HR"],
      },
      {
        label: "Forms & Templates",
        icon: FilesIcon,
        path: "hr/forms",
        departments: ["HR"],
      },
      {
        label: "Performance Management",
        icon: GaugeIcon,
        path: "hr/performance",
        departments: ["HR"],
      },
      {
        label: "Training & Development",
        icon: BookBookmarkIcon,
        path: "hr/training",
        departments: ["HR"],
      },
    ],
  },

  // =================================================
  // IT
  // =================================================
  {
    segmentTitle: "IT",
    segmentCode: "IT",

    links: [
      {
        label: "Dashboard",
        icon: SquaresFourIcon,
        path: "it/dashboard",

        departments: ["IT"],
      },

      {
        label: "IT Assets",
        icon: MonitorIcon,
        path: "it/assets",

        departments: ["IT"],
      },

      {
        label: "Software",
        icon: AppWindowIcon,
        path: "it/software",

        departments: ["IT"],
      },
    ],
  },

  // =================================================
  // ADMIN
  // =================================================
  {
    segmentTitle: "SYSTEM",
    segmentCode: "SYS",

    links: [
      {
        label: "Users",
        icon: UsersIcon,
        path: "system/users",

        roles: ["superadmin"],
      },

      {
        label: "Audit Logs",
        icon: FileTextIcon,
        path: "admin/audit-logs",

        roles: ["superadmin"],
      },

      {
        label: "System Settings",
        icon: GearIcon,
        path: "admin/settings",

        roles: ["superadmin"],
      },
    ],
  },

  // =================================================
  // SUPPORT
  // =================================================
  {
    segmentTitle: null,
    segmentCode: null,

    links: [
      {
        label: "Help & Support",
        icon: QuestionIcon,
        path: "help",
      },
    ],
  },
];

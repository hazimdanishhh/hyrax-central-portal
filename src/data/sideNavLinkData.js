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
  TruckIcon,
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

      // {
      //   label: "Announcements",
      //   icon: MegaphoneIcon,
      //   path: "announcements",
      // },

      // {
      //   label: "Notifications",
      //   icon: BellIcon,
      //   path: "notifications",
      // },

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
  // {
  //   segmentTitle: "WORKSPACE",
  //   segmentCode: "SPACE",

  //   links: [
  //     {
  //       label: "Projects",
  //       icon: SquaresFourIcon,
  //       path: "workspace/projects",
  //     },

  //     {
  //       label: "Tasks",
  //       icon: ListDashesIcon,
  //       path: "workspace/tasks",
  //     },

  //     {
  //       label: "Documents",
  //       icon: FoldersIcon,
  //       path: "workspace/documents",
  //     },
  //   ],
  // },

  // =================================================
  // EMPLOYEE
  // =================================================
  // {
  //   segmentTitle: "EMPLOYEE",
  //   segmentCode: "EMPLOYEE",

  //   links: [
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

  //     {
  //       label: "Claims",
  //       icon: WalletIcon,
  //       path: "employee/claims",
  //     },
  //   ],
  // },

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
        label: "Clients",
        icon: UsersIcon,
        path: "sales/clients",

        departments: ["SAL"],
      },

      {
        label: "Leads",
        icon: HandshakeIcon,
        path: "sales/leads",

        departments: ["SAL"],
      },

      // {
      //   label: "Quotations",
      //   icon: FileTextIcon,
      //   path: "sales/quotations",

      //   departments: ["SAL"],
      // },
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

        departments: ["FIN", "SAL"],
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
  // OPERATIONS
  // =================================================
  {
    segmentTitle: "OPERATIONS",
    segmentCode: "OPERATIONS",

    links: [
      {
        label: "Reports",
        icon: ChartBarIcon,
        path: "operations/reports",

        departments: ["OPS"],
        roles: ["manager"],
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
        label: "Reports",
        icon: ChartBarIcon,
        path: "hr/reports",
        departments: ["HR"],
      },

      {
        label: "Employee Management",
        icon: UsersFourIcon,
        path: "hr/employees",

        departments: ["HR"],
      },

      // {
      //   label: "Department Management",
      //   icon: UsersThreeIcon,
      //   path: "hr/departments",

      //   departments: ["HR"],
      //   roles: ["manager"],
      // },

      {
        label: "Attendance Management",
        icon: ClipboardTextIcon,
        path: "hr/attendance",

        departments: ["HR"],
      },

      // {
      //   label: "Leave Management",
      //   icon: CalendarIcon,
      //   path: "hr/leaves",

      //   departments: ["HR"],
      // },

      // {
      //   label: "Recruitment",
      //   icon: BriefcaseIcon,
      //   path: "hr/recruitment",

      //   departments: ["HR"],
      //   roles: ["manager"],
      // },

      // {
      //   label: "Onboarding Management",
      //   icon: AddressBookIcon,
      //   path: "hr/onboarding",
      //   departments: ["HR"],
      // },
      // {
      //   label: "Policy Management",
      //   icon: FilesIcon,
      //   path: "hr/policies",
      //   departments: ["HR"],
      // },
      // {
      //   label: "Forms & Templates",
      //   icon: FilesIcon,
      //   path: "hr/forms",
      //   departments: ["HR"],
      // },
      // {
      //   label: "Performance Management",
      //   icon: GaugeIcon,
      //   path: "hr/performance",
      //   departments: ["HR"],
      // },
      // {
      //   label: "Training & Development",
      //   icon: BookBookmarkIcon,
      //   path: "hr/training",
      //   departments: ["HR"],
      // },
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

      // {
      //   label: "Audit Logs",
      //   icon: FileTextIcon,
      //   path: "admin/audit-logs",

      //   roles: ["superadmin"],
      // },

      // {
      //   label: "System Settings",
      //   icon: GearIcon,
      //   path: "admin/settings",

      //   roles: ["superadmin"],
      // },
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

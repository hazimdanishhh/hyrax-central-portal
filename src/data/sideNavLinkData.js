// src/data/sideNavLinkData.js

import {
  HouseIcon,
  UserCircleIcon,
  SquaresFourIcon,
  FolderIcon,
  ListChecksIcon,
  FileIcon,
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
  InfoIcon,
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
  ReceiptIcon,
  InvoiceIcon,
  HandCoinsIcon,
  BookOpenIcon,
  TreeStructureIcon,
  ArrowsClockwiseIcon,
  ScalesIcon,
  ChartLineUpIcon,
  UserCheckIcon,
  LinkIcon,
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
  // Projects & Tasks module built out 2026-08 -- general access, no
  // departments/roles restriction, matching
  // supabase/access-control/README.md's own existing R2 classification for
  // Workspace ("no single department owns the data... unrestricted").
  // Documents is a real, fully-built module (project-scoped Google Drive
  // library), not a stub -- see docs/PROJECTS-TASKS-ARCHITECTURE.md.
  // Icon convention across the whole module: folder = project,
  // check-list = task, file = document.
  {
    segmentTitle: "WORKSPACE",
    segmentCode: "SPACE",

    links: [
      {
        label: "Projects",
        icon: FolderIcon,
        path: "workspace/projects",
      },

      {
        label: "Tasks",
        icon: ListChecksIcon,
        path: "workspace/tasks",
      },

      {
        label: "Documents",
        icon: FileIcon,
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
        label: "My Attendance",
        icon: ClipboardTextIcon,
        path: "employee/attendance",
      },

      {
        label: "Team Attendance",
        icon: UserCheckIcon,
        path: "employee/team-attendance",

        roles: ["manager"],
      },

      // {
      //   label: "Leave Request",
      //   icon: CalendarIcon,
      //   path: "employee/leave-request",
      // },

      // {
      //   label: "Claims",
      //   icon: WalletIcon,
      //   path: "employee/claims",
      // },
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

        departments: ["SAL", "MGM"],
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

      {
        label: "Sales Orders",
        icon: ReceiptIcon,
        path: "sales/orders",

        departments: ["SAL"],
      },

      {
        label: "Sales Rep Mapping",
        icon: LinkIcon,
        path: "sales/rep-mapping",

        departments: ["SAL"],
        roles: ["manager"],
      },

      // Quotations: intentional placeholder, not an orphan (confirmed
      // 2026-08) -- reserved for a future in-app quotation-generation
      // feature (SAP's own OQUT/QUT1 module is unused by Hyrax). Left
      // commented out until the page has real content, not an oversight.
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

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      // Gate matches finance/balance-sheet's AccessRoute exactly: manager-only
      // (departments: ["FIN","MGM"], roles: ["manager"]), same as Reports --
      // NOT department-only like Journal Entries/Chart of Accounts. Known
      // open discrepancy (found 2026-08 audit) vs. an earlier draft of this
      // comment that claimed department-only parity; left as-is pending a
      // decision on which behavior is actually intended. Added 2026-08.
      {
        label: "Balance Sheet",
        icon: ScalesIcon,
        path: "finance/balance-sheet",

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      // Gate matches finance/income-statement's AccessRoute exactly:
      // manager-only, same known open discrepancy as Balance Sheet above.
      // Added 2026-08, Finance Expansion Phase 6.
      {
        label: "Income Statement",
        icon: ChartLineUpIcon,
        path: "finance/income-statement",

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      // Gate matches finance/cash-flow's AccessRoute exactly: manager-only,
      // same known open discrepancy as Balance Sheet/Income Statement above
      // (an earlier draft of this comment claimed department-only parity
      // with Journal Entries/Chart of Accounts; the code has always been
      // manager-only, left as-is pending a decision). Added 2026-08, Finance
      // Expansion Phase 3.
      {
        label: "Cash Flow",
        icon: ArrowsClockwiseIcon,
        path: "finance/cash-flow",

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      {
        label: "Invoices",
        icon: FileTextIcon,
        path: "finance/invoices",

        departments: ["FIN"],
      },

      // Gate matches finance/bills' AccessRoute exactly (department-only, no
      // role restriction, same as Invoices/Payments -- these are Tier-1
      // individual-contributor pages per docs/DASHBOARD-CONVENTIONS.md, not
      // manager-exclusive; MGM sees the rollup via Finance Reports instead).
      {
        label: "Bills",
        icon: InvoiceIcon,
        path: "finance/bills",

        departments: ["FIN"],
      },

      // {
      //   label: "Claims Management",
      //   icon: ClipboardTextIcon,
      //   path: "finance/claims-management",

      //   departments: ["FIN"],
      // },

      {
        label: "Incoming Payments",
        icon: CoinsIcon,
        path: "finance/payments",
        departments: ["FIN"],
      },

      // Gate matches finance/vendor-payments' AccessRoute exactly (department
      // only, no role restriction).
      {
        label: "Outgoing Payments",
        icon: HandCoinsIcon,
        path: "finance/vendor-payments",
        departments: ["FIN"],
      },

      // Gate matches finance/journal-entries'/finance/chart-of-accounts'
      // AccessRoute exactly (department-only, no role restriction -- same
      // Tier-1 rationale as Invoices/Bills above).
      {
        label: "Journal Entries",
        icon: BookOpenIcon,
        path: "finance/journal-entries",

        departments: ["FIN"],
      },

      {
        label: "Chart of Accounts",
        icon: TreeStructureIcon,
        path: "finance/chart-of-accounts",

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

        departments: ["OPS", "MGM"],
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

      {
        label: "Organization Chart",
        icon: TreeStructureIcon,
        path: "hr/organization-chart",

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

      {
        label: "Pipeline Status",
        icon: ChartLineUpIcon,
        path: "system/pipeline-status",

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

      {
        label: "About",
        icon: InfoIcon,
        path: "about",
      },
    ],
  },
];

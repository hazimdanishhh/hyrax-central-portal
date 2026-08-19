// src/data/departmentLinkCardData.js

import {
  BriefcaseIcon,
  ChartBarIcon,
  UsersIcon,
  HandshakeIcon,
  WalletIcon,
  FileTextIcon,
  ClipboardTextIcon,
  CoinsIcon,
  TruckIcon,
  AddressBookIcon,
  UsersFourIcon,
  GearIcon,
  SquaresFourIcon,
  MonitorIcon,
  AppWindowIcon,
  ReceiptIcon,
  InvoiceIcon,
  HandCoinsIcon,
  BookOpenIcon,
  TreeStructureIcon,
  ArrowsClockwiseIcon,
  ScalesIcon,
  ChartLineUpIcon,
} from "@phosphor-icons/react";

// Config-driven "department link cards" shown on the Dashboard homepage.
// Curated top-level launcher links only (NOT a full sidenav mirror) — see
// sideNavLinkData.js for the exhaustive per-page sidenav config. Filtered
// the same way as the sidenav (canAccess({roles, departments})), just
// applied to this config instead. `path` is relative — no leading slash,
// no "/app" prefix — DepartmentLinkCard prefixes it with "/app/".
export const departmentLinkCardData = [
  // =================================================
  // SALES
  // =================================================
  {
    segmentTitle: "SALES",
    segmentCode: "SALES",
    icon: BriefcaseIcon,

    links: [
      {
        label: "Reports",
        description:
          "Pipeline attainment, win rates and department performance.",
        icon: ChartBarIcon,
        path: "sales/reports",

        departments: ["SAL", "MGM"],
        roles: ["manager"],
      },

      {
        label: "Clients",
        description: "Manage client accounts, contacts and portfolios.",
        icon: UsersIcon,
        path: "sales/clients",

        departments: ["SAL"],
      },

      {
        label: "Leads",
        description: "Track and progress deals through your sales pipeline.",
        icon: HandshakeIcon,
        path: "sales/leads",

        departments: ["SAL"],
      },

      {
        label: "Sales Orders",
        description: "Browse SAP sales orders booked across the department.",
        icon: ReceiptIcon,
        path: "sales/orders",

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
    icon: WalletIcon,

    links: [
      {
        label: "Reports",
        description: "Revenue, collections and AR health for Finance.",
        icon: ChartBarIcon,
        path: "finance/reports",

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      // Matches finance/balance-sheet's AccessRoute gate exactly:
      // manager-only (departments: ["FIN","MGM"], roles: ["manager"]), same
      // as Reports -- NOT department-only like Journal Entries/Chart of
      // Accounts. Known open discrepancy (found 2026-08 audit) vs. an
      // earlier draft of this comment; left as-is pending a decision on
      // which behavior is actually intended. Added 2026-08.
      {
        label: "Balance Sheet",
        description:
          "Statement of financial position (Assets, Liabilities, Equity) as of today.",
        icon: ScalesIcon,
        path: "finance/balance-sheet",

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      // Matches finance/income-statement's AccessRoute gate exactly:
      // manager-only, same known open discrepancy as Balance Sheet above.
      // Added 2026-08, Finance Expansion Phase 6.
      {
        label: "Income Statement",
        description:
          "Statement of profit or loss (Revenue through Net Profit) for a selected period.",
        icon: ChartLineUpIcon,
        path: "finance/income-statement",

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      // Matches finance/cash-flow's AccessRoute gate exactly: manager-only,
      // same known open discrepancy as Balance Sheet/Income Statement above.
      // Added 2026-08, Finance Expansion Phase 3.
      {
        label: "Cash Flow",
        description:
          "Statement of cash flows (Operating/Investing/Financing) for a selected period.",
        icon: ArrowsClockwiseIcon,
        path: "finance/cash-flow",

        departments: ["FIN", "MGM"],
        roles: ["manager"],
      },

      {
        label: "Invoices",
        description: "View and track outstanding customer invoices.",
        icon: FileTextIcon,
        path: "finance/invoices",

        // Department-only, no role restriction -- Tier-1 individual
        // contributor page per docs/DASHBOARD-CONVENTIONS.md, matches
        // FinanceRoutes.jsx's AccessRoute gate exactly.
        departments: ["FIN"],
      },

      // Matches finance/bills' AccessRoute gate exactly (mirrors Invoices'
      // route gate above -- department-only, no role restriction).
      {
        label: "Bills",
        description: "View and track outstanding vendor bills.",
        icon: InvoiceIcon,
        path: "finance/bills",

        departments: ["FIN"],
      },

      // {
      //   label: "Claims Management",
      //   description: "Process and track expense and reimbursement claims.",
      //   icon: ClipboardTextIcon,
      //   path: "finance/claims-management",

      //   departments: ["FIN"],
      // },

      {
        label: "Incoming Payments",
        description: "Review incoming customer payments.",
        icon: CoinsIcon,
        path: "finance/payments",

        departments: ["FIN"],
      },

      // Matches finance/vendor-payments' AccessRoute gate exactly (department
      // only, no role restriction).
      {
        label: "Outgoing Payments",
        description: "Review outgoing payments to vendors.",
        icon: HandCoinsIcon,
        path: "finance/vendor-payments",

        departments: ["FIN"],
      },

      // Matches finance/journal-entries'/finance/chart-of-accounts'
      // AccessRoute gate exactly (department-only, no role restriction --
      // same Tier-1 rationale as Invoices/Bills above).
      {
        label: "Journal Entries",
        description: "Browse General Ledger journal entries and their lines.",
        icon: BookOpenIcon,
        path: "finance/journal-entries",

        departments: ["FIN"],
      },

      {
        label: "Chart of Accounts",
        description: "Reference list of Hyrax's chart of accounts.",
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
    icon: TruckIcon,

    links: [
      {
        label: "Reports",
        description: "Order backlog, fulfilment and delivery performance.",
        icon: ChartBarIcon,
        path: "operations/reports",

        departments: ["OPS", "MGM"],
        roles: ["manager"],
      },
    ],
  },

  // =================================================
  // HUMAN RESOURCES
  // =================================================
  {
    segmentTitle: "HUMAN RESOURCES",
    segmentCode: "HR",
    icon: AddressBookIcon,

    links: [
      // "Reports" intentionally omitted — hr/reports has no matching route
      // in HRRoutes.jsx (confirmed dead link), even though it still exists
      // in sideNavLinkData.js.
      {
        label: "Employee Management",
        description: "Manage employee records and org structure.",
        icon: UsersFourIcon,
        path: "hr/employees",

        departments: ["HR"],
      },

      {
        label: "Attendance Management",
        description: "Review clock-ins, clock-outs and daily attendance.",
        icon: ClipboardTextIcon,
        path: "hr/attendance",

        departments: ["HR"],
      },

      {
        label: "Organization Chart",
        description: "Visualize reporting lines across the company.",
        icon: TreeStructureIcon,
        path: "hr/organization-chart",

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
    icon: GearIcon,

    links: [
      {
        label: "Dashboard",
        description: "Quick links to IT tools and admin consoles.",
        icon: SquaresFourIcon,
        path: "it/dashboard",

        departments: ["IT"],
      },

      {
        label: "IT Assets",
        description: "Track and manage company hardware and devices.",
        icon: MonitorIcon,
        path: "it/assets",

        departments: ["IT"],
      },

      {
        label: "Software",
        description: "Manage software licenses and installations.",
        icon: AppWindowIcon,
        path: "it/software",

        departments: ["IT"],
      },
    ],
  },
];

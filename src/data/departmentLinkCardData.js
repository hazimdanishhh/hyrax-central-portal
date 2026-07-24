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
        description: "Pipeline attainment, win rates and department performance.",
        icon: ChartBarIcon,
        path: "sales/reports",

        departments: ["SAL"],
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
        roles: ["manager"],
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

        departments: ["FIN", "SAL"],
        roles: ["manager"],
      },

      {
        label: "Invoices",
        description: "View and track outstanding customer invoices.",
        icon: FileTextIcon,
        path: "finance/invoices",

        // Matches FinanceRoutes.jsx's AccessRoute gate exactly. Note this is
        // stricter than sideNavLinkData.js's current "Invoices" entry, which
        // is missing this roles gate even though the route requires it —
        // don't copy that mismatch here.
        departments: ["FIN"],
        roles: ["manager"],
      },

      {
        label: "Claims Management",
        description: "Process and track expense and reimbursement claims.",
        icon: ClipboardTextIcon,
        path: "finance/claims-management",

        departments: ["FIN"],
      },

      {
        label: "Payments",
        description: "Review incoming customer payments.",
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
    icon: TruckIcon,

    links: [
      {
        label: "Reports",
        description: "Order backlog, fulfilment and delivery performance.",
        icon: ChartBarIcon,
        path: "operations/reports",

        departments: ["OPS"],
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

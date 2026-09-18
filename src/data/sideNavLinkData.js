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
  ReceiptIcon,
  InvoiceIcon,
  BookOpenIcon,
  TreeStructureIcon,
  ArrowsClockwiseIcon,
  ScalesIcon,
  ChartLineUpIcon,
  UserCheckIcon,
  LinkIcon,
  DoorOpenIcon,
  IdentificationBadgeIcon,
} from "@phosphor-icons/react";
import { leadsPageTabs } from "../pages/user/sales/leads/leadsPageTabs";
import { ordersPageTabs } from "../pages/user/sales/orders/ordersPageTabs";
import { clientsPageTabs } from "../pages/user/sales/clients/clientsPageTabs";
import { invoicesPageTabs } from "../pages/user/finance/invoices/invoicesPageTabs";
import { billsPageTabs } from "../pages/user/finance/bills/billsPageTabs";
import { attendancePageTabs as hrAttendancePageTabs } from "../pages/user/hr/attendanceManagement/attendancePageTabs";
import { employeePageTabs } from "../pages/user/hr/employeeManagement/employeePageTabs";
import { attendancePageTabs as myAttendancePageTabs } from "../pages/user/employee/attendance/attendancePageTabs";
import { teamAttendancePageTabs } from "../pages/user/employee/teamAttendance/teamAttendancePageTabs";
import { itAssetsPageTabs } from "../pages/user/it/ITAssetManagement/itAssetsPageTabs";
import { helpCategories } from "./help/helpCategories";

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

        // Same array AttendancePageLayout.jsx (employee module) renders as
        // its own page-tab bar -- see its attendancePageTabs.js header
        // comment.
        tabs: myAttendancePageTabs,
      },

      {
        label: "Team Attendance",
        icon: UserCheckIcon,
        path: "employee/team-attendance",

        roles: ["manager"],
        // Same array TeamAttendancePageLayout.jsx renders as its own
        // page-tab bar -- see teamAttendancePageTabs.js's header comment.
        tabs: teamAttendancePageTabs,
      },

      // Self-service onboarding/offboarding -- read-only views of the
      // caller's own open case, if any (universal route, no department/role
      // gate, matching route_access_matrix.csv). Reinstated in the sidenav
      // per explicit decision -- originally left out under "most employees
      // never have an open case, so an always-visible nav entry is
      // clutter," reversed after real UAT testing showed relying solely on
      // notification deep links left the pages undiscoverable. See
      // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md.
      {
        label: "Onboarding",
        icon: AddressBookIcon,
        path: "employee/onboarding",
      },

      {
        label: "Offboarding",
        icon: DoorOpenIcon,
        path: "employee/offboarding",
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

        departments: ["SAL", "MGM"],
        // Same array ClientsPageLayout.jsx renders as its own page-tab bar
        // -- see clientsPageTabs.js's header comment.
        tabs: clientsPageTabs,
      },

      {
        label: "Leads Pipeline",
        icon: HandshakeIcon,
        path: "sales/leads",

        departments: ["SAL", "MGM"],
        // Same array LeadsPageLayout.jsx renders as its own page-tab bar --
        // see leadsPageTabs.js's header comment for why there's only one
        // list to keep in sync.
        tabs: leadsPageTabs,
      },

      {
        label: "Sales Orders",
        icon: ReceiptIcon,
        path: "sales/orders",

        departments: ["SAL", "MGM"],
        // Same array OrdersPageLayout.jsx renders as its own page-tab bar --
        // see ordersPageTabs.js's header comment.
        tabs: ordersPageTabs,
      },

      {
        label: "Sales Rep Mapping",
        icon: LinkIcon,
        path: "sales/rep-mapping",

        departments: ["SAL", "MGM"],
        roles: ["manager"],
      },

      {
        label: "Guides",
        icon: BookOpenIcon,
        path: "sales/guides",

        // No role restriction -- every SAL/MGM staff member can read every
        // topic, including ones documenting manager-only pages
        // (Reports/Rep Mapping/Targets/Budgets). Reading about a page isn't
        // the same as having access to it.
        departments: ["SAL", "MGM"],
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

      // MGM added company-wide 2026-09, mirroring Sales' own 2026-09 MGM
      // reversal on Clients/Leads/Orders -- see FinanceRoutes.jsx's own
      // comment on this route for the full rationale. Merged with the old
      // standalone "Incoming Payments" entry 2026-09 (standardization pass,
      // Finance Phase 1) -- same array InvoicesPageLayout.jsx renders as its
      // own page-tab bar, see invoicesPageTabs.js's header comment.
      {
        label: "Invoices & A/R",
        icon: FileTextIcon,
        path: "finance/invoices",

        departments: ["FIN", "MGM"],
        tabs: invoicesPageTabs,
      },

      // Gate matches finance/bills' AccessRoute exactly (department-only, no
      // role restriction, same as Invoices -- these are Tier-1
      // individual-contributor pages per docs/DASHBOARD-CONVENTIONS.md).
      // MGM added company-wide 2026-09 -- see Invoices' own comment above.
      // Merged with the old standalone "Outgoing Payments" entry 2026-09 --
      // same array BillsPageLayout.jsx renders as its own page-tab bar, see
      // billsPageTabs.js's header comment.
      {
        label: "Bills & A/P",
        icon: InvoiceIcon,
        path: "finance/bills",

        departments: ["FIN", "MGM"],
        tabs: billsPageTabs,
      },

      // {
      //   label: "Claims Management",
      //   icon: ClipboardTextIcon,
      //   path: "finance/claims-management",

      //   departments: ["FIN", "MGM"],
      // },

      // Gate matches finance/journal-entries'/finance/chart-of-accounts'
      // AccessRoute exactly (department-only, no role restriction -- same
      // Tier-1 rationale as Invoices/Bills above). MGM added company-wide
      // 2026-09 -- see Invoices' own comment above.
      {
        label: "Journal Entries",
        icon: BookOpenIcon,
        path: "finance/journal-entries",

        departments: ["FIN", "MGM"],
      },

      {
        label: "Chart of Accounts",
        icon: TreeStructureIcon,
        path: "finance/chart-of-accounts",

        departments: ["FIN", "MGM"],
      },

      // Added 2026-09 alongside the Finance standardization pass -- same
      // department-only gate as Journal Entries/Chart of Accounts. Also
      // the destination SAPCustomerCard.jsx/SAPVendorCard.jsx now link a
      // customer/vendor badge to for any viewer without Sales access.
      {
        label: "Business Partners",
        icon: IdentificationBadgeIcon,
        path: "finance/business-partners",

        departments: ["FIN", "MGM"],
      },
    ],
  },

  // =================================================
  // OPERATIONS
  // =================================================
  {
    segmentTitle: "OPERATIONS",
    segmentCode: "OPS",

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
        // Was department-only (no role restriction) while the route itself
        // was a dead link -- updated to match the route's real gate now
        // that HRReports.jsx exists (HR/MGM manager or superadmin, same R5
        // pattern as Sales/Finance/Operations Reports).
        departments: ["HR", "MGM"],
        roles: ["manager"],
      },

      {
        label: "Employee Management",
        icon: UsersFourIcon,
        path: "hr/employees",

        departments: ["HR"],
        // Same array EmployeePageLayout.jsx renders as its own page-tab bar
        // -- see employeePageTabs.js's header comment.
        tabs: employeePageTabs,
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
        // Same array AttendancePageLayout.jsx renders as its own page-tab
        // bar -- see attendancePageTabs.js's header comment.
        tabs: hrAttendancePageTabs,
      },

      {
        label: "Leave Management",
        icon: CalendarIcon,
        path: "hr/leaves",

        departments: ["HR"],
      },

      {
        label: "Organization Chart",
        icon: TreeStructureIcon,
        path: "hr/organization-chart",

        departments: ["HR"],
      },

      // {
      //   label: "Recruitment",
      //   icon: BriefcaseIcon,
      //   path: "hr/recruitment",

      //   departments: ["HR"],
      //   roles: ["manager"],
      // },

      // Reactivates this previously-dead slot -- see
      // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md.
      {
        label: "Onboarding",
        icon: AddressBookIcon,
        path: "hr/onboarding",
        departments: ["HR"],
      },
      {
        label: "Offboarding",
        icon: DoorOpenIcon,
        path: "hr/offboarding",
        departments: ["HR"],
      },
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
        // Same array ITAssetsPageLayout.jsx renders as its own page-tab bar
        // -- see itAssetsPageTabs.js's header comment.
        tabs: itAssetsPageTabs,
      },

      {
        label: "Software",
        icon: AppWindowIcon,
        path: "it/software",

        departments: ["IT"],
      },

      {
        label: "Onboarding",
        icon: AddressBookIcon,
        path: "it/onboarding",

        departments: ["IT"],
      },

      {
        label: "Offboarding",
        icon: DoorOpenIcon,
        path: "it/offboarding",

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

        // Reuses HelpPageLayout.jsx's own tab data directly (already the
        // exact {label, icon, path} shape) -- Help is universal (R2, no
        // AccessRoute anywhere in HelpRoutes.jsx), so no roles/departments
        // needed on these tabs either.
        tabs: helpCategories,
      },

      {
        label: "About",
        icon: InfoIcon,
        path: "about",
      },
    ],
  },
];

// src/data/changelogData.js
//
// Version history shown on the About page. Plain git-versioned array, same
// convention as announcementData.js. changelogEntries[0] is always the
// current version -- CURRENT_VERSION/CURRENT_STATUS are derived from it, not
// from package.json, so there's one place to update per release. See
// docs/RELEASING.md.

export const changelogEntries = [
  {
    version: "0.9.0",
    date: "2026-08-18",
    status: "uat",
    title: "Workspace Module & About Page",
    modules: [
      {
        module: "Workspace",
        changes: [
          "Launched the Workspace module: Projects, Tasks, and Documents.",
          "Added notifications for project/task assignment and status changes.",
        ],
      },
      {
        module: "Platform",
        changes: [
          "Added the About page, with the platform's version and update history.",
        ],
      },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-08-14",
    status: "uat",
    title: "Notifications & Email",
    modules: [
      {
        module: "Platform",
        changes: [
          "Added in-app notifications (bell icon) and email alerts.",
          "Added reminders for employee confirmation and contract renewal dates.",
        ],
      },
      { module: "HR", changes: ["Restructured Employee Management page URLs."] },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-08-07",
    status: "uat",
    title: "Sales: Prospects & SAP Customers",
    modules: [
      {
        module: "Sales",
        changes: [
          "Renamed Clients to Prospects; SAP Customers are now the primary customer list.",
          "Added the SAP Clients page and Sales Rep Mapping.",
        ],
      },
      {
        module: "Finance",
        changes: ["Added Days Inventory Outstanding (DIO) to the Finance dashboard."],
      },
      {
        module: "Platform",
        changes: ["Added a pipeline status page showing the latest SAP/IoT data sync."],
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-07-30",
    status: "uat",
    title: "Financial Statements & Attendance Overview",
    modules: [
      {
        module: "Finance",
        changes: ["Added Cash Flow Statement, Balance Sheet, and Income Statement."],
      },
      {
        module: "HR",
        changes: [
          "Rebuilt the Attendance overview, with My Attendance and Team Attendance pages.",
          "Linked KPI cards across Employee Management, Attendance, Leads, and Finance dashboards.",
        ],
      },
      { module: "Platform", changes: ["Added the Help & Support page."] },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-01",
    status: "uat",
    title: "Finance Module & HR Org Chart",
    modules: [
      {
        module: "Finance",
        changes: [
          "Launched the Finance module: dashboard, Sales & Operations reports, targets and budgets.",
          "Added Accounts Payable (bills, outgoing payments) and General Ledger pages.",
        ],
      },
      {
        module: "HR",
        changes: [
          "Added the Organization Chart, showing reporting lines.",
          "Added an RPC-backed Employees dashboard.",
        ],
      },
      {
        module: "Platform",
        changes: ["Added department- and role-based access rules across every route."],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-01",
    status: "uat",
    title: "Sales Analytics & AI Summaries",
    modules: [
      {
        module: "Sales",
        changes: [
          "Added the Leads Analytics Overview, with charts and PDF/CSV export.",
          "Added Google Drive document linking for leads and clients.",
        ],
      },
      {
        module: "HR",
        changes: ["Attendance now reads directly from the office and plant biometric scanners."],
      },
      { module: "Platform", changes: ["Added AI-generated summaries to dashboards."] },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-05-18",
    status: "uat",
    title: "Sales Leads Module Launch",
    modules: [
      {
        module: "Sales",
        changes: [
          "Launched the Sales Leads module: pipeline stages, lead details, and Client Management.",
        ],
      },
      {
        module: "HR",
        changes: ["Added System User Management and bulk actions for employee records."],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-02-04",
    status: "uat",
    title: "HR Core: Employees, IT Assets & Attendance",
    modules: [
      {
        module: "HR",
        changes: [
          "Added the Employee directory, department pages, and Employee Management.",
          "Added Attendance tracking, with approval and rejection for self and team.",
        ],
      },
      { module: "IT", changes: ["Added the IT Assets module."] },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-01-29",
    status: "uat",
    title: "Platform Foundations",
    modules: [
      {
        module: "Platform",
        changes: [
          "Launched Hyrax Central Portal with Google sign-in.",
          "Added user profiles and the executive dashboard link.",
        ],
      },
    ],
  },
];

export const CURRENT_VERSION = changelogEntries[0].version;
export const CURRENT_STATUS = changelogEntries[0].status;

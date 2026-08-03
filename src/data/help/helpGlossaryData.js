// src/data/help/helpGlossaryData.js

// Plain-language translation of terms this portal's own dashboards actually
// show. Deliberately excludes SAP-internal terms (OSLP, RCT2, DocEntry, ...)
// -- that stays hyrax-data-platform's documented domain; this glossary is a
// simplified consumer-facing layer, never a re-derivation of that schema.
export const helpGlossaryItems = [
  {
    id: "glossary-list",
    type: "glossary",
    title: "List",
    body: "A day-to-day operational table you work out of -- a record-level view (e.g. a list of invoices, leads, or assets), used daily.",
    tags: ["list", "tier"],
    departments: [],
  },
  {
    id: "glossary-overview",
    type: "glossary",
    title: "Overview",
    body: "How one specific area (like Leads or Assets) is doing on its own -- a step up from a List, used by the team running it and their manager.",
    tags: ["overview", "tier"],
    departments: [],
  },
  {
    id: "glossary-reports",
    type: "glossary",
    title: "Reports",
    body: "How an entire department is doing -- combines multiple entities into one picture, checked weekly or monthly by department heads.",
    tags: ["reports", "tier"],
    departments: [],
  },
  {
    id: "glossary-executive-summary",
    type: "glossary",
    title: "Executive Summary",
    body: "How the whole company is doing across every department -- for leadership, checked monthly or quarterly. Planned; not built yet.",
    tags: ["executive summary", "tier"],
    departments: [],
  },
  {
    id: "glossary-dso",
    type: "glossary",
    title: "DSO (Days Sales Outstanding)",
    body: "The average number of days it takes to collect payment after an invoice is issued. Lower is generally better -- it means cash comes in faster.",
    tags: ["dso", "finance", "cash", "collections"],
    departments: ["FIN"],
  },
  {
    id: "glossary-dpo",
    type: "glossary",
    title: "DPO (Days Payable Outstanding)",
    body: "The average number of days it takes the company to pay its own vendor bills after receiving them.",
    tags: ["dpo", "finance", "vendor", "payables"],
    departments: ["FIN"],
  },
  {
    id: "glossary-gl",
    type: "glossary",
    title: "GL (General Ledger)",
    body: "The company's official accounting record of every financial transaction -- the source of truth for real profit/loss and balance-sheet figures, as opposed to a subledger (like invoices or bills) which tracks one type of transaction only.",
    tags: ["gl", "general ledger", "finance", "accounting"],
    departments: ["FIN"],
  },
  {
    id: "glossary-ebitda",
    type: "glossary",
    title: "EBITDA",
    body: "Earnings Before Interest, Tax, Depreciation, and Amortization -- a profitability measure that strips out financing and accounting decisions, often used to compare core operating performance.",
    tags: ["ebitda", "finance", "profitability"],
    departments: ["FIN"],
  },
  {
    id: "glossary-ar-ap-aging",
    type: "glossary",
    title: "AR / AP Aging",
    body: "A breakdown of outstanding customer invoices (AR -- Accounts Receivable) or vendor bills (AP -- Accounts Payable) by how overdue they are, e.g. 0-30 days, 31-60 days, and so on.",
    tags: ["ar", "ap", "aging", "receivable", "payable", "overdue"],
    departments: ["FIN"],
  },
  {
    id: "glossary-departments",
    type: "glossary",
    title: "Department codes (SAL, FIN, HR, IT, OPS, MGM)",
    body: "The department codes used throughout this portal to control what you can see: SAL = Sales, FIN = Finance, HR = Human Resources, IT = Information Technology, OPS = Operations, MGM = Top Management.",
    tags: ["department", "code", "sal", "fin", "hr", "it", "ops", "mgm"],
    departments: [],
  },
  {
    id: "glossary-roles",
    type: "glossary",
    title: "Roles (staff, manager, superadmin)",
    body: "Your role, together with your department, determines what you can see and do in this portal. Staff have standard access; managers additionally see their department's Reports pages; superadmins bypass all restrictions.",
    tags: ["role", "staff", "manager", "superadmin", "permission"],
    departments: [],
  },
];

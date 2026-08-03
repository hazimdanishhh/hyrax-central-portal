// src/data/help/helpFaqData.js

// Starter content -- add more questions as they actually come up. Each item:
// { id, type: "faq", title, body (markdown), tags, departments (soft tag) }
export const helpFaqItems = [
  {
    id: "faq-page-access",
    type: "faq",
    title: "Why can't I see a page or module in the sidebar?",
    body: "The sidebar only shows pages your role and department are allowed to see. Most department pages (Sales, Finance, HR, IT, Operations) are restricted to staff in that department, and a few pages -- like a department's Reports page -- are manager-only. If you've changed teams recently, or think you should have access to something you can't see, reach out via the **Contact & Escalation** tab.",
    tags: ["access", "sidebar", "permission", "department", "role", "restricted"],
    departments: [],
  },
  {
    id: "faq-figures-mismatch",
    type: "faq",
    title: "Why don't two numbers on different dashboards match?",
    body: "This is usually expected, not a bug. Dashboards in this portal deliberately keep certain figures separate rather than blending them -- for example, Finance's General Ledger revenue and the sales-order invoice figure are two different, equally valid views of revenue, and a CRM-reported pipeline number will naturally differ from an SAP-recognized (invoiced) number. Every tile and chart in this portal labels its actual source table, so if two numbers disagree, check their labels -- they're very likely measuring two genuinely different things, not showing an error.",
    tags: [
      "reconciliation",
      "mismatch",
      "revenue",
      "general ledger",
      "invoice",
      "discrepancy",
      "numbers don't match",
    ],
    departments: ["FIN", "SAL"],
  },
  {
    id: "faq-export-report",
    type: "faq",
    title: "How do I export a report?",
    body: "Departmental Reports pages (Sales, Finance, Operations) have an **Export** button near the top of the page that generates a PDF snapshot of that report, including its charts and KPI tiles. Look for the download icon next to the report's filters.",
    tags: ["export", "pdf", "download", "report", "print"],
    departments: [],
  },
  {
    id: "faq-wrong-number",
    type: "faq",
    title: "Who do I contact if a number on a dashboard looks wrong?",
    body: "Start with the **Contact & Escalation** tab on this page -- it lists who to reach for each department. If it's a data discrepancy (not just an access issue), it helps to note exactly which page, tile, and date range you were looking at.",
    tags: ["contact", "support", "wrong number", "data issue", "escalation"],
    departments: [],
  },
];

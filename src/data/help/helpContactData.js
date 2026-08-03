// src/data/help/helpContactData.js

// Starter content, adapted from hyrax-it-knowledgebase's
// helpdesk-and-sla.md concept (informal response targets, not contractual
// SLAs -- Hyrax IT is a team of one today).
//
// IMPORTANT: `contactTarget` values below are placeholders. Per this org's
// own documented rule (hyrax-it-knowledgebase/CLAUDE.md: "Never fabricate
// factual content ... to fill a `[fill in]` placeholder -- ask the admin or
// leave it"), do not invent a real email/channel here -- fill in the actual
// contact channel for each department before shipping.
export const helpContactItems = [
  {
    id: "contact-it",
    type: "contact",
    title: "IT Help & Support",
    summary:
      "As a small IT team, these are informal targets, not contractual SLAs -- the goal is setting expectations, not ticketing bureaucracy.",
    body: "| Severity | Example | Target Response |\n|---|---|---|\n| Critical | System down, security incident | Immediate |\n| High | Can't work -- account locked, device broken | Same business day |\n| Medium | Non-blocking issue, feature request | 2-3 business days |\n| Low | General question | Best effort |",
    contactChannel: "email",
    contactTarget: "[fill in -- e.g. email address, chat channel, or ticketing tool used today]",
    departments: ["IT"],
  },
  {
    id: "contact-sales",
    type: "contact",
    title: "Sales",
    summary: "For CRM/lead access issues or sales pipeline questions.",
    contactChannel: "email",
    contactTarget: "[fill in]",
    departments: ["SAL"],
  },
  {
    id: "contact-finance",
    type: "contact",
    title: "Finance",
    summary: "For invoice, payment, or financial reporting questions.",
    contactChannel: "email",
    contactTarget: "[fill in]",
    departments: ["FIN"],
  },
  {
    id: "contact-hr",
    type: "contact",
    title: "HR",
    summary: "For leave, payroll, benefits, and employee-record questions.",
    contactChannel: "email",
    contactTarget: "[fill in]",
    departments: ["HR"],
  },
  {
    id: "contact-operations",
    type: "contact",
    title: "Operations",
    summary: "For order fulfilment and logistics questions.",
    contactChannel: "email",
    contactTarget: "[fill in]",
    departments: ["OPS"],
  },
];

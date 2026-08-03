// src/data/help/helpGuideData.js

import { AddressBookIcon, FilesIcon } from "@phosphor-icons/react";

// Starter content, rendered on the "Guides & Policies" tab.
// type: "link"  -> an in-app link-out card (icon/label/description/path)
// type: "guide" -> a short markdown how-to, rendered in a FaqAccordion
export const helpGuideItems = [
  {
    id: "link-onboarding",
    type: "link",
    title: "New Hire Onboarding",
    summary: "Your first-week checklist: accounts, equipment, and where to start.",
    icon: AddressBookIcon,
    path: "employee/onboarding",
    departments: [],
  },
  {
    id: "link-policies",
    type: "link",
    title: "Company Policies",
    summary: "Acceptable Use Policy and other company-wide policies.",
    icon: FilesIcon,
    path: "employee/policies",
    departments: [],
  },
  {
    id: "guide-clock-in-out",
    type: "guide",
    title: "Clocking in and out",
    body: "From your **Dashboard** (the portal's home page), find the **Attendance Activity** card. If you're not currently clocked in, tap the fingerprint button, choose your attendance type (Office, Site Visit, or Work From Home), and optionally attach a photo. Once you're clocked in, the same fingerprint button clocks you out -- no type selection needed.",
    tags: [
      "attendance",
      "clock in",
      "clock out",
      "fingerprint",
      "cuti",
      "office",
      "work from home",
    ],
    departments: [],
  },
  {
    id: "guide-list-pages",
    type: "guide",
    title: "How list pages work (search, filter, sort, add records)",
    body: "Most record lists in this portal (Leads, Clients, Invoices, IT Assets, Employees, and more) share the same layout: a search bar and filter button at the top, a sortable table in the middle, and -- where you have permission to create records -- an **Add** button that opens a slide-in panel to fill in the new record's details. Clicking any row opens that same slide-in panel to view or edit it.",
    tags: ["list", "table", "filter", "sort", "search", "add", "create", "edit"],
    departments: [],
  },
  {
    id: "guide-aup-summary",
    type: "guide",
    title: "Acceptable Use Policy -- quick summary",
    body: "The full policy lives on the **Company Policies** page (linked above). A few of the most important rules: keep your password and MFA personal and never share them; report a lost device or a suspicious email/link immediately; keep company data (financial, HR, customer) on approved company systems only, never personal email or unapproved cloud storage; only install company-approved software on company devices.",
    tags: ["policy", "aup", "acceptable use", "security", "password", "mfa"],
    departments: [],
  },
];

// src/data/help/helpCategories.js

import {
  ChatCircleTextIcon,
  BookOpenIcon,
  BookBookmarkIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react";

// One entry per Help tab/route. Add a new tab by adding a line here plus a
// matching child route in HelpRoutes.jsx and a leaf page under
// src/pages/user/help/ -- nothing else needs to change.
export const helpCategories = [
  { id: "faq", label: "FAQ", icon: ChatCircleTextIcon, path: "faq" },
  {
    id: "guides",
    label: "Guides & Policies",
    icon: BookOpenIcon,
    path: "guides",
  },
  { id: "glossary", label: "Glossary", icon: BookBookmarkIcon, path: "glossary" },
  {
    id: "contact",
    label: "Contact & Escalation",
    icon: LifebuoyIcon,
    path: "contact",
  },
];

// Soft filter chips only -- never used to hide content (Help stays
// universal/R2). Mirrors the department codes already used by
// AccessControlContext/sideNavLinkData.
export const HELP_DEPARTMENTS = [
  { code: "SAL", label: "Sales" },
  { code: "FIN", label: "Finance" },
  { code: "HR", label: "HR" },
  { code: "IT", label: "IT" },
  { code: "OPS", label: "Operations" },
];

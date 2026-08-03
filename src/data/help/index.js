// src/data/help/index.js
//
// Help content lives as plain, git-versioned arrays -- same convention as
// quickActionsCardData.js/departmentLinkCardData.js/sideNavLinkData.js.
// No Supabase table, no CMS: editing content here is editing content
// everywhere else in this app.
//
// Migration trigger (don't build this speculatively -- only once true):
// move to a Supabase-backed `help_content` table only when either
//   (a) a non-developer needs to edit content without a code deploy, or
//   (b) content volume grows an order of magnitude past what one file
//       review can manage.
// Neither is true today.

export { helpCategories, HELP_DEPARTMENTS } from "./helpCategories";
export { helpFaqItems } from "./helpFaqData";
export { helpGuideItems } from "./helpGuideData";
export { helpGlossaryItems } from "./helpGlossaryData";
export { helpContactItems } from "./helpContactData";

import { helpFaqItems } from "./helpFaqData";
import { helpGuideItems } from "./helpGuideData";
import { helpGlossaryItems } from "./helpGlossaryData";
import { helpContactItems } from "./helpContactData";

// Flattened, used only by the cross-category search bar.
export const allHelpItems = [
  ...helpFaqItems,
  ...helpGuideItems,
  ...helpGlossaryItems,
  ...helpContactItems,
];

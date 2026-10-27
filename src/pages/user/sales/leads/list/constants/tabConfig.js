// src/pages/user/sales/leads/list/constants/tabConfig.js
//
// The Leads list's status tabs (rebuilt 2026-10-27, DASHBOARD-CONVENTIONS
// §2a), rendered by components/crud/statusTabs/StatusTabs.
//
//   * Switching tab KEEPS the period, filters, search and sort (tabLink);
//     until now every tab link replaced the whole query string.
//   * Exactly ONE tab is active (activeLeadTab), the most specific match --
//     before, several could light up at once, or none.
//   * The KPI cards link here with the same keys, so a card and its tab
//     open the same leads.
//   * Stage colours as before.
import { tabLink } from "../../../../../../functions/statusTabs";

// Every URL key a tab or a KPI card sets. Switching tab clears them all,
// then sets the new tab's own. lostOrCancelled / closedOnly arrive from
// Leads Overview links; createdBefore from the Aging card.
export const LEAD_TAB_KEYS = [
  "stage",
  "onHold",
  "cancelled",
  "activePipelineOnly",
  "pendingSapOrder",
  "lostOrCancelled",
  "closedOnly",
  "createdBefore",
];

const open = (stage) => ({ stage, onHold: "false", cancelled: "false" });

export const LEAD_TABS = [
  { key: "all", label: "All", themeType: "", set: {} },
  { key: "active", label: "Active", themeType: "blue", set: { activePipelineOnly: "true" } },
  { key: "DISCOVERY", label: "Discovery", themeType: "blue", set: open("DISCOVERY") },
  { key: "SAMPLE_TEST", label: "Sample Test", themeType: "blue", set: open("SAMPLE_TEST") },
  { key: "PROPOSAL", label: "Proposal", themeType: "blue", set: open("PROPOSAL") },
  { key: "NEGOTIATION", label: "Negotiation", themeType: "blue", set: open("NEGOTIATION") },
  // Won and Pending SAP leave cancelled leads out: a cancelled won lead is
  // lost (decision D5), the same rule as Leads Overview and Reports.
  { key: "WON", label: "Won", themeType: "approval", set: { stage: "WON", cancelled: "false" } },
  {
    key: "pendingSap",
    label: "Pending SAP",
    themeType: "rejection",
    set: { stage: "WON", pendingSapOrder: "true", cancelled: "false" },
  },
  { key: "LOST", label: "Lost", themeType: "rejection", set: { stage: "LOST" } },
  // Open leads on hold -- the On Hold card's own rule, so the two agree.
  {
    key: "onHold",
    label: "On Hold",
    themeType: "yellow",
    set: { activePipelineOnly: "true", onHold: "true" },
  },
  { key: "cancelled", label: "Cancelled", themeType: "rejection", set: { cancelled: "true" } },
];

/** The one active tab, the most specific match first. */
export function activeLeadTab(searchParams) {
  const get = (k) => searchParams.get(k);
  if (get("cancelled") === "true") return "cancelled";
  if (get("onHold") === "true") return "onHold";
  if (get("pendingSapOrder") === "true") return "pendingSap";
  const stage = get("stage");
  if (stage) return LEAD_TABS.some((t) => t.key === stage) ? stage : "all";
  if (get("lostOrCancelled") === "true") return "LOST";
  if (get("activePipelineOnly") === "true") return "active";
  return "all";
}

/** Tabs for StatusTabs: each link keeps everything but the tab keys. */
export function leadStatusTabs(searchParams) {
  const active = activeLeadTab(searchParams);
  return LEAD_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    themeType: t.themeType,
    to: tabLink(searchParams, t.set, LEAD_TAB_KEYS),
    isActive: t.key === active,
  }));
}

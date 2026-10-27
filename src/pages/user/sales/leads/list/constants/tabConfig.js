// src/pages/user/sales/leads/list/constants/tabConfig.js
//
// The Leads list's status tabs (rebuilt 2026-10-27, DASHBOARD-CONVENTIONS
// §2a / §10), rendered by components/crud/statusTabs/StatusTabs.
//
//   * Every tab is a plain test on sales_leads_list's columns -- outcome
//     (open / won / lost, cancelled = lost, decision D5), stage, is_on_hold,
//     is_cancelled, pending_sap_order -- which are sales_lead_facts' rules,
//     so a tab holds exactly the leads the Overview and Reports count.
//   * Switching tab KEEPS the period, filters, search and sort (tabLink).
//   * Exactly ONE tab is active (activeLeadTab), the most specific match.
//   * The KPI cards and the Overview / Reports links use the same keys, so a
//     card, a link and its tab open the same leads.
//   * "Won or lost" (outcome=closed, from the Win Rate links) is not a tab of
//     its own; it shows only while it is the active filter.
import { tabLink } from "../../../../../../functions/statusTabs";

// Every URL key a tab, a card or an incoming link sets. Switching tab
// clears them all, then sets the new tab's own.
export const LEAD_TAB_KEYS = [
  "outcome",
  "stage",
  "onHold",
  "cancelled",
  "pendingSapOrder",
  "createdBefore",
];

// An open lead at one pipeline stage, not on hold.
const atStage = (stage) => ({ outcome: "open", stage, onHold: "false" });

export const LEAD_TABS = [
  { key: "all", label: "All", themeType: "", set: {} },
  { key: "active", label: "Active", themeType: "blue", set: { outcome: "open" } },
  { key: "DISCOVERY", label: "Discovery", themeType: "blue", set: atStage("DISCOVERY") },
  { key: "SAMPLE_TEST", label: "Sample Test", themeType: "blue", set: atStage("SAMPLE_TEST") },
  { key: "PROPOSAL", label: "Proposal", themeType: "blue", set: atStage("PROPOSAL") },
  { key: "NEGOTIATION", label: "Negotiation", themeType: "blue", set: atStage("NEGOTIATION") },
  // Open leads on hold -- the On Hold card's own rule.
  { key: "onHold", label: "On Hold", themeType: "yellow", set: { outcome: "open", onHold: "true" } },
  { key: "won", label: "Won", themeType: "approval", set: { outcome: "won" } },
  {
    key: "pendingSap",
    label: "Pending SAP",
    themeType: "rejection",
    set: { pendingSapOrder: "true" },
  },
  // Lost includes cancelled leads (D5) -- the Overview's and Reports' Lost.
  { key: "lost", label: "Lost", themeType: "rejection", set: { outcome: "lost" } },
  { key: "cancelled", label: "Cancelled", themeType: "rejection", set: { cancelled: "true" } },
];

// Shown only while active (an incoming link set it).
const CLOSED_TAB = {
  key: "closed",
  label: "Won or lost",
  themeType: "",
  set: { outcome: "closed" },
};

/** The one active tab, the most specific match first. */
export function activeLeadTab(searchParams) {
  const get = (k) => searchParams.get(k);
  if (get("cancelled") === "true") return "cancelled";
  if (get("pendingSapOrder") === "true") return "pendingSap";
  const outcome = get("outcome");
  if (outcome === "open") {
    if (get("onHold") === "true") return "onHold";
    const stage = get("stage");
    if (stage) return LEAD_TABS.some((t) => t.key === stage) ? stage : "active";
    return "active";
  }
  if (outcome === "won") return "won";
  if (outcome === "lost") return "lost";
  if (outcome === "closed") return "closed";
  return "all";
}

/** Tabs for StatusTabs: each link keeps everything but the tab keys. */
export function leadStatusTabs(searchParams) {
  const active = activeLeadTab(searchParams);
  const tabs = active === "closed" ? [...LEAD_TABS, CLOSED_TAB] : LEAD_TABS;
  return tabs.map((t) => ({
    key: t.key,
    label: t.label,
    themeType: t.themeType,
    to: tabLink(searchParams, t.set, LEAD_TAB_KEYS),
    isActive: t.key === active,
  }));
}

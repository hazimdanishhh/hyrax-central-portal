// src/pages/user/sales/leads/list/constants/overviewConfig.js
//
// The Leads LIST page's KPI cards (rebuilt 2026-10-27, DASHBOARD-CONVENTIONS
// §2a). Data: get_leads_overview.
//
//   * Each card's number is exactly what clicking it shows. The cards follow
//     the list's period (created date), panel filters and search -- like the
//     list -- but NOT the status tab: the cards and the tabs are the same
//     buckets, so a card that shrank with the tab would just read 0.
//   * Definitions are the shared metric layer's (sales_lead_facts), so with
//     no filters (All time, everyone) these equal Leads Overview's Today
//     figures: Active Pipeline, Pending SAP Order Entry, On Hold, Aging.
//   * Clicking a card switches to its tab and keeps everything else
//     (tabLink) -- the same keys the tab itself sets, so card and tab agree.
//   * Colours: Active Pipeline is a plain figure (blue); the other three are
//     "something to act on" (actionTileStatus: green at 0, amber Watch).

import {
  ClockCountdownIcon,
  FunnelIcon,
  HourglassHighIcon,
  PauseCircleIcon,
} from "@phosphor-icons/react";
import { preciseCurrency } from "../../../../../../functions/formatNumber";
import { toLocalDateString } from "../../../../../../functions/dateRangeFilters";
import { actionTileStatus } from "../../../../../../functions/reportFormat";
import { tabLink } from "../../../../../../functions/statusTabs";
import { LEAD_TAB_KEYS } from "./tabConfig";

// The Leads list's Aging rule: open, not on hold, created 30+ days ago
// (sales_pipeline_totals' aging_* and get_leads_overview use the same 30).
export const AGING_DAYS = 30;

export function agingCutoff() {
  return toLocalDateString(
    new Date(Date.now() - AGING_DAYS * 24 * 60 * 60 * 1000),
  );
}

export function getLeadsListOverviewConfig(kpis, { searchParams, period }) {
  const link = (set) => tabLink(searchParams, set, LEAD_TAB_KEYS);
  const windowLabel =
    period?.mode === "all" ? "All time" : `Created ${period?.title ?? ""}`;

  const active = link({ outcome: "open" });
  const pending = link({ pendingSapOrder: "true" });
  const onHold = link({ outcome: "open", onHold: "true" });
  // The count's own cutoff (the database's date), so the list it opens has the same leads.
  const aging = link({
    outcome: "open",
    onHold: "false",
    createdBefore: kpis.agingCutoff ?? agingCutoff(),
  });

  return [
    {
      icon: FunnelIcon,
      label: "Active Pipeline",
      sublabel: windowLabel,
      value: preciseCurrency(kpis.activeValue),
      variant: "blueCard",
      to: active,
      metrics: [
        { label: "Active Leads", value: kpis.activeCount ?? 0, to: active },
        { label: "Weighted", value: preciseCurrency(kpis.weightedValue) },
      ],
      title:
        "Open leads -- not won, lost or cancelled, on-hold leads included -- at expected " +
        "revenue. Weighted multiplies each by its close probability. Same rule as Leads " +
        "Overview's Active Pipeline.",
    },
    {
      icon: ClockCountdownIcon,
      label: "Pending SAP",
      sublabel: windowLabel,
      value: preciseCurrency(kpis.pendingSapOrderValue),
      ...actionTileStatus(kpis.pendingSapOrderCount),
      to: pending,
      metrics: [
        {
          label: "Won Leads",
          value: kpis.pendingSapOrderCount ?? 0,
          to: pending,
        },
      ],
      title:
        "Won leads whose PO number no SAP sales order carries yet -- at won revenue. " +
        "Cancelled leads left out. Green when there are none, amber (Watch) when there are any.",
    },
    {
      icon: PauseCircleIcon,
      label: "On Hold",
      sublabel: windowLabel,
      value: preciseCurrency(kpis.onHoldValue),
      ...actionTileStatus(kpis.onHoldCount),
      to: onHold,
      metrics: [{ label: "Leads", value: kpis.onHoldCount ?? 0, to: onHold }],
      title:
        "Open leads paused by their owner, at expected revenue. Green when there are none, " +
        "amber (Watch) when there are any.",
    },
    {
      icon: HourglassHighIcon,
      label: `Aging ${AGING_DAYS}+ Days`,
      sublabel: windowLabel,
      value: preciseCurrency(kpis.agingValue),
      ...actionTileStatus(kpis.agingCount),
      to: aging,
      metrics: [{ label: "Leads", value: kpis.agingCount ?? 0, to: aging }],
      title:
        `Open leads, not on hold, created more than ${AGING_DAYS} days ago, at expected ` +
        "revenue. Green when there are none, amber (Watch) when there are any.",
    },
  ];
}

import {
  FunnelIcon,
  ReceiptIcon,
  PauseCircleIcon,
  HourglassHighIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../../../functions/formatNumber";
import { toLocalDateString } from "../../../../../../functions/dateRangeFilters";

// Keep in lockstep with get_leads_overview_rpc.sql's v_aging_cutoff.
const AGING_DAYS = 30;

/**
 * Four tiles for the Leads LIST page (Tier 1, operational): what in the
 * currently-filtered view needs attention right now. The analytical figures
 * (win rate, avg deal size, trends) stay on the sibling Overview tab.
 *
 * Every tile/metric sets `to: "."` explicitly rather than omitting it --
 * OverviewCards' resolveLinkTo defaults an omitted `to` to "../list", which
 * happens to resolve correctly from this route but only by coincidence.
 *
 * Filter values are STRINGS ("true", not true) because usePaginatedQuery
 * reads them straight back out of the URL as strings -- same shape the stage
 * quick-tabs in tabConfig.js already produce.
 */
export function getLeadsListOverviewConfig(kpis) {
  const activeFilter = { activePipelineOnly: "true" };

  // stage:"WON" is redundant with pending_sap_order (the view column already
  // requires stage = 'WON'), but tabConfig.js's PENDING SAP quick-tab keys
  // its isActive off currentStage === "WON" && isPendingSAP -- include it so
  // clicking the tile also lights up the matching tab.
  const pendingSapFilter = { stage: "WON", pendingSapOrder: "true" };

  const onHoldFilter = { onHold: "true" };

  // onHold:"false" excludes the On Hold tile's own rows (no double-count);
  // endDate maps to created_at <= … in fetchLeads, which is exactly the
  // RPC's `created_at <= v_aging_cutoff + interval '1 day'`.
  const agingFilter = {
    activePipelineOnly: "true",
    onHold: "false",
    endDate: toLocalDateString(
      new Date(Date.now() - AGING_DAYS * 24 * 60 * 60 * 1000),
    ),
  };

  return [
    {
      icon: FunnelIcon,
      label: "Active Pipeline",
      value: compactCurrency(kpis.activeValue),
      variant: "blueCardFill",
      to: ".",
      filter: activeFilter,
      metrics: [
        { label: "Leads", value: kpis.activeCount, to: ".", filter: activeFilter },
      ],
      title: `Open leads — not Won, Lost or Cancelled — at expected revenue — ${compactCurrency(kpis.activeValue)}`,
    },
    {
      icon: ReceiptIcon,
      label: "Pending SAP Order",
      value: compactCurrency(kpis.pendingSapOrderValue),
      variant: kpis.pendingSapOrderCount > 0 ? "redCard" : "greenCard",
      to: ".",
      filter: pendingSapFilter,
      metrics: [
        {
          label: "Won Leads",
          value: kpis.pendingSapOrderCount,
          to: ".",
          filter: pendingSapFilter,
        },
      ],
      title: `Won leads whose PO number has no matching Sales Order in SAP yet — at actual revenue — ${compactCurrency(kpis.pendingSapOrderValue)}`,
    },
    {
      icon: PauseCircleIcon,
      label: "On Hold",
      value: compactCurrency(kpis.onHoldValue),
      variant: kpis.onHoldCount > 0 ? "yellowCard" : "greenCard",
      to: ".",
      filter: onHoldFilter,
      metrics: [
        { label: "Leads", value: kpis.onHoldCount, to: ".", filter: onHoldFilter },
      ],
      title: `Leads explicitly paused by their owner — at expected revenue — ${compactCurrency(kpis.onHoldValue)}`,
    },
    {
      icon: HourglassHighIcon,
      label: `Aging ${AGING_DAYS}d+`,
      value: compactCurrency(kpis.agingValue),
      variant: kpis.agingCount > 0 ? "yellowCard" : "greenCard",
      to: ".",
      filter: agingFilter,
      metrics: [
        { label: "Leads", value: kpis.agingCount, to: ".", filter: agingFilter },
      ],
      title: `Open leads, not on hold, opened more than ${AGING_DAYS} days ago — at expected revenue — ${compactCurrency(kpis.agingValue)}`,
    },
  ];
}

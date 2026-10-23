// src/pages/user/sales/leads/overview/config/overviewConfig.js
//
// Leads Overview tiles (rebuilt 2026-10-23 to DASHBOARD-CONVENTIONS §8).
// Every figure comes from get_sales_leads_dashboard, which reads the shared
// Sales metric layer -- the same Generated / Won / Lost / Active Pipeline
// as Sales Reports' Pipeline tab. Each tile links to the Leads list with the
// list's own filters for exactly those leads.

import {
  ClockCountdownIcon,
  FunnelIcon,
  GaugeIcon,
  HourglassHighIcon,
  HourglassMediumIcon,
  PauseCircleIcon,
  PercentIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react";
import { preciseCurrency } from "../../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../../functions/statusVariant";
import { toLocalDateString } from "../../../../../../functions/dateRangeFilters";
import {
  TARGET_THRESHOLDS,
  calcDelta,
  deltaText,
  lastYearMetric,
  pctText,
  periodLinkFilter,
  pointsDeltaText,
  actionTileStatus,
  todayTile,
} from "../../../../../../functions/reportFormat";

const LIST = "../list";
// The Leads list's own Aging rule (get_leads_overview / list overviewConfig).
export const AGING_DAYS = 30;

/** Link filters, so every tile opens the list on exactly its leads. */
function leadLinks(meta, owner) {
  const ownerFilter = owner ? { owner } : {};
  const p = periodLinkFilter(meta);
  const closed = p.startDate ? { closedDateFrom: p.startDate, closedDateTo: p.endDate } : {};
  return {
    ownerFilter,
    created: { ...ownerFilter, ...p }, // the list's startDate/endDate filter created_at
    won: { ...ownerFilter, stage: "WON", cancelled: "false", ...closed },
    closed: { ...ownerFilter, closedOnly: "true", ...closed },
    lost: { ...ownerFilter, lostOrCancelled: "true", ...closed },
    active: { ...ownerFilter, activePipelineOnly: "true" },
  };
}

/** Pipeline KPIs: period figures left, the Today tile rightmost (R2). */
export function getPipelineKpis({ kpis, meta, period, against, owner }) {
  const links = leadLinks(meta, owner);
  const targetStatus = getStatusVariant(kpis.targetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: TARGET_THRESHOLDS,
  });
  const vsExpected =
    kpis.wonExpected > 0 ? Math.round(((kpis.won - kpis.wonExpected) / kpis.wonExpected) * 100) : null;

  return [
    {
      icon: PlusCircleIcon,
      label: "Pipeline Generated",
      sublabel: period.title,
      value: preciseCurrency(kpis.generated),
      subvalue: deltaText(calcDelta(kpis.generated, kpis.prevGenerated), against),
      variant: "blueCard",
      to: LIST,
      filter: links.created,
      metrics: [
        { label: "Leads Created", value: kpis.generatedCount ?? 0, to: LIST, filter: links.created },
        lastYearMetric(meta, kpis.generated, kpis.lastYearGenerated, preciseCurrency),
      ],
      title:
        "Expected revenue of leads created in the period, whatever has happened to them since " +
        "-- the new business feeding the pipeline.",
    },
    {
      icon: GaugeIcon,
      label: "Pipeline Won",
      sublabel: `${period.title} · vs Pipeline Target`,
      value: preciseCurrency(kpis.won),
      delta: pctText(kpis.targetAttainmentPct),
      subvalue: deltaText(calcDelta(kpis.won, kpis.prevWon), against),
      variant: targetStatus.variant,
      status: targetStatus.statusIcon
        ? { icon: targetStatus.statusIcon, label: targetStatus.statusLabel }
        : undefined,
      to: LIST,
      filter: links.won,
      metrics: [
        {
          label: "Pipeline Target",
          value: kpis.target == null ? "none set" : preciseCurrency(kpis.target),
          to: "/app/sales/leads/targets",
          filter: links.ownerFilter,
        },
        {
          label: "Avg. Deal Size",
          value: kpis.avgDeal == null ? "—" : preciseCurrency(kpis.avgDeal),
        },
        {
          label: "vs Expected Value",
          value:
            vsExpected == null
              ? "—"
              : `${vsExpected >= 0 ? "+" : ""}${vsExpected}% (${preciseCurrency(kpis.wonExpected)})`,
          title: "What the won leads brought against what they were expected to bring when open.",
        },
        lastYearMetric(meta, kpis.won, kpis.lastYearWon, preciseCurrency),
      ],
      title:
        "Revenue on leads won in the period (cancelled leads excluded; close date in Malaysia " +
        "time), against the Pipeline Target for the same days. Same figure as Sales Reports' " +
        "Pipeline tab. Colour: Critical below 60% of target, Watch 60–89%, On track at 90%+.",
    },
    {
      icon: PercentIcon,
      label: "Win Rate",
      sublabel: period.title,
      value: pctText(kpis.winRatePct),
      subvalue: pointsDeltaText(kpis.winRatePct, kpis.prevWinRatePct, against),
      variant: "blueCard",
      to: LIST,
      filter: links.closed,
      metrics: [
        { label: "Won Leads", value: kpis.wonCount ?? 0, to: LIST, filter: links.won },
        { label: "Total Lost Deals", value: kpis.lostCount ?? 0, to: LIST, filter: links.lost },
        {
          label: "Lost Revenue",
          value: preciseCurrency(kpis.lost),
          to: LIST,
          filter: links.lost,
          title: "Expected revenue of leads lost or cancelled in the period. Reasons are in Pipeline Breakdown.",
        },
        {
          icon: HourglassMediumIcon,
          label: "Pipeline Cycle",
          value: kpis.avgDaysToWon == null ? "—" : `${kpis.avgDaysToWon}d`,
          title: "Average days from a lead being created to it being won, for leads won in the period.",
        },
      ],
      title:
        "Won leads ÷ leads closed (won + lost + cancelled) in the period, by count. The change " +
        "is in percentage points.",
    },
    todayTile({
      icon: FunnelIcon,
      label: "Active Pipeline",
      value: preciseCurrency(kpis.openValue),
      variant: "blueCard",
      to: LIST,
      filter: links.active,
      metrics: [
        { label: "Weighted", value: preciseCurrency(kpis.weightedValue) },
        { label: "Active Leads", value: kpis.openCount ?? 0, to: LIST, filter: links.active },
        {
          label: "Pipeline Coverage",
          value: kpis.pipelineCoverage == null ? "—" : `${kpis.pipelineCoverage}×`,
          title:
            kpis.targetRemaining == null
              ? "No Pipeline Target left this fiscal year."
              : `Active Pipeline ÷ the Pipeline Target still to win this fiscal year ` +
                `(${preciseCurrency(kpis.targetRemaining)}). About 3× is a common B2B benchmark.`,
        },
      ],
      title:
        "Expected revenue of every open, uncancelled lead right now (on-hold leads included). " +
        "Weighted multiplies each lead by its close probability. An open balance: today, " +
        "whatever period is picked.",
    }),
  ];
}

/** Active Pipeline · Today: the daily work, each a list filter. */
export function getActivePipelineKpis({ kpis, owner }) {
  const ownerFilter = owner ? { owner } : {};
  const agingCutoff = toLocalDateString(new Date(Date.now() - AGING_DAYS * 24 * 60 * 60 * 1000));
  const pendingFilter = { ...ownerFilter, stage: "WON", pendingSapOrder: "true", cancelled: "false" };
  const onHoldFilter = { ...ownerFilter, activePipelineOnly: "true", onHold: "true" };
  const agingFilter = { ...ownerFilter, activePipelineOnly: "true", onHold: "false", endDate: agingCutoff };

  return [
    todayTile({
      icon: ClockCountdownIcon,
      label: "Pending SAP Order Entry",
      value: preciseCurrency(kpis.pendingSapValue),
      ...actionTileStatus(kpis.pendingSapCount),
      to: LIST,
      filter: pendingFilter,
      metrics: [{ label: "Won Leads", value: kpis.pendingSapCount ?? 0, to: LIST, filter: pendingFilter }],
      title:
        "Won leads whose PO number no SAP sales order carries yet -- waiting on the sales " +
        "admin. Cancelled leads left out. Green when there are none, amber (Watch) when there are any.",
    }),
    todayTile({
      icon: PauseCircleIcon,
      label: "On Hold",
      value: preciseCurrency(kpis.onHoldValue),
      ...actionTileStatus(kpis.onHoldCount),
      to: LIST,
      filter: onHoldFilter,
      metrics: [{ label: "Leads", value: kpis.onHoldCount ?? 0, to: LIST, filter: onHoldFilter }],
      title: "Open leads paused by their owner, at expected revenue. Green when there are none, amber (Watch) when there are any.",
    }),
    todayTile({
      icon: HourglassHighIcon,
      label: `Aging ${AGING_DAYS}+ Days`,
      value: preciseCurrency(kpis.agingValue),
      ...actionTileStatus(kpis.agingCount),
      to: LIST,
      filter: agingFilter,
      metrics: [{ label: "Leads", value: kpis.agingCount ?? 0, to: LIST, filter: agingFilter }],
      title:
        `Open leads, not on hold, created more than ${AGING_DAYS} days ago -- the Leads list's ` +
        "own Aging rule. Green when there are none, amber (Watch) when there are any.",
    }),
  ];
}

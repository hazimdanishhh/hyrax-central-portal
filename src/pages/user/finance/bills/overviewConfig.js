import {
  StackIcon,
  InvoiceIcon,
  ClockIcon,
  WarningCircleIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";

/**
 * AP mirror of finance/invoices/overviewConfig.js -- same five-tile shape
 * (Total, then Outstanding / Due Soon / Overdue / Critically Overdue), same
 * reasoning throughout.
 */
export function getBillsOverviewConfig(kpis) {
  // hasBalanceOnly matters here -- every tile below also requires
  // (total_amount_myr - paid_to_date) > 0.01 in get_bills_overview_rpc.sql,
  // so without it the drill-through list would include open bills already
  // paid in full, which the KPI never counted (see
  // finance_outstanding_balance_views.sql).
  const baseFilter = {
    statusCode: "O",
    isCancelled: "N",
    hasBalanceOnly: "true",
  };
  const dueSoonFilter = { ...baseFilter, dueSoonOnly: "true" };
  const overdueFilter = { ...baseFilter, overdueOnly: "true" };
  const criticallyOverdueFilter = {
    ...baseFilter,
    criticallyOverdueOnly: "true",
  };

  return [
    {
      icon: InvoiceIcon,
      label: "Outstanding Bills",
      value: compactCurrency(kpis.outstandingValue),
      variant: "blueCardFill",
      to: ".",
      filter: baseFilter,
      metrics: [
        {
          label: "Bills",
          value: kpis.outstandingCount,
          to: ".",
          filter: baseFilter,
        },
        {
          // Total (added 2026-09): gross total_amount_myr across every bill
          // matching the CURRENT filters -- including toggles the tiles below
          // deliberately never react to (see get_bills_overview_rpc.sql's
          // totals_scope comment). No `to`/`filter`: see
          // finance/invoices/overviewConfig.js's own comment for why -- same
          // deliberate exception to DASHBOARD-CONVENTIONS.md §2a.
          icon: StackIcon,
          label: "Total Bills",
          value: `${compactCurrency(kpis.totalValue)} (${kpis.totalCount})`,
          to: null,
          title: `Total billed amount across every bill matching the current filters — ${compactCurrency(kpis.totalValue)}`,
        },
      ],
      title: `Outstanding balance across open bills, as of today — ${compactCurrency(kpis.outstandingValue)}`,
    },
    {
      icon: ClockIcon,
      label: "Due Soon",
      value: compactCurrency(kpis.dueSoonValue),
      variant: kpis.dueSoonCount > 0 ? "yellowCard" : "greenCard",
      to: ".",
      filter: dueSoonFilter,
      metrics: [
        {
          label: "Bills",
          value: kpis.dueSoonCount,
          to: ".",
          filter: dueSoonFilter,
        },
      ],
      title: `Open bills due within the next 7 days — ${compactCurrency(kpis.dueSoonValue)}`,
    },
    {
      icon: WarningCircleIcon,
      label: "Overdue",
      value: compactCurrency(kpis.overdueValue),
      variant: kpis.overdueCount > 0 ? "redCard" : "greenCard",
      to: ".",
      filter: overdueFilter,
      metrics: [
        {
          label: "Bills",
          value: kpis.overdueCount,
          to: ".",
          filter: overdueFilter,
        },
      ],
      title: `Open bills past their due date, as of today — ${compactCurrency(kpis.overdueValue)}`,
    },
    {
      icon: WarningOctagonIcon,
      label: "Critically Overdue",
      value: compactCurrency(kpis.criticallyOverdueValue),
      variant: kpis.criticallyOverdueCount > 0 ? "redCard" : "greenCard",
      to: ".",
      filter: criticallyOverdueFilter,
      metrics: [
        {
          label: "Bills",
          value: kpis.criticallyOverdueCount,
          to: ".",
          filter: criticallyOverdueFilter,
        },
      ],
      title: `Open bills 90+ days past due, as of today — ${compactCurrency(kpis.criticallyOverdueValue)}`,
    },
  ];
}

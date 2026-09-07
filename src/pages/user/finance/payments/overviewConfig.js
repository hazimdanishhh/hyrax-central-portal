import {
  CoinsIcon,
  ClockIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";

/**
 * Three tiles, a different shape from Orders/Invoices/Bills -- sap_payments
 * has no due-date-shaped field at all (a payment is already-settled, not
 * something that can itself be "overdue"), so there's no backlog/urgency
 * framing here. Unallocated Cash is the one genuinely actionable, never-
 * before-surfaced-as-a-plain-stat figure (get_finance_dashboard_rpc.sql
 * aggregates the same thing, but only inside a period-bound chart-card
 * total, never as a headline number); This Week/This Month are volume-pulse
 * figures instead of urgency flags. `to: "."` on every tile/metric, not
 * omitted -- see sales/orders/overviewConfig.js's own comment for why.
 */
export function getPaymentsOverviewConfig(kpis) {
  // isCancelled: "N" matters here -- get_payments_overview_rpc.sql's
  // base_payments CTE excludes cancelled payments (SAP doesn't always zero
  // out a cancelled payment's unallocated_amount), so without this the
  // drill-through list would include cancelled rows the KPI never counted.
  const unallocatedFilter = { unallocatedOnly: "true", isCancelled: "N" };
  const thisWeekFilter = {
    isCancelled: "N",
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  };
  const now = new Date();
  const thisMonthFilter = {
    isCancelled: "N",
    startDate: new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0],
    endDate: now.toISOString().split("T")[0],
  };

  return [
    {
      icon: CoinsIcon,
      label: "Unallocated Cash",
      value: compactCurrency(kpis.unallocatedValue),
      variant: kpis.unallocatedCount > 0 ? "yellowCard" : "greenCard",
      to: ".",
      filter: unallocatedFilter,
      metrics: [
        {
          label: "Payments",
          value: kpis.unallocatedCount,
          to: ".",
          filter: unallocatedFilter,
        },
      ],
      title: `Cash received but not yet applied to any invoice, as of today — ${compactCurrency(kpis.unallocatedValue)}`,
    },
    {
      icon: ClockIcon,
      label: "Received This Week",
      value: compactCurrency(kpis.thisWeekValue),
      variant: "blueCard",
      to: ".",
      filter: thisWeekFilter,
      metrics: [
        {
          label: "Payments",
          value: kpis.thisWeekCount,
          to: ".",
          filter: thisWeekFilter,
        },
      ],
      title: `Payments received in the last 7 days — ${compactCurrency(kpis.thisWeekValue)}`,
    },
    {
      icon: CalendarBlankIcon,
      label: "Received This Month",
      value: compactCurrency(kpis.thisMonthValue),
      variant: "blueCardFill",
      to: ".",
      filter: thisMonthFilter,
      metrics: [
        {
          label: "Payments",
          value: kpis.thisMonthCount,
          to: ".",
          filter: thisMonthFilter,
        },
      ],
      title: `Payments received this month, month to date — ${compactCurrency(kpis.thisMonthValue)}`,
    },
  ];
}

import {
  FileTextIcon,
  ClockIcon,
  WarningCircleIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";

/**
 * Four tiles (Outstanding / Due Soon / Overdue / Critically Overdue), same
 * two-tier RM+count shape as FinancialReports.jsx's own "Overdue Risk"/
 * "Outstanding AR" tiles -- this is the same underlying figure, just scoped
 * to this list page instead of the full dashboard. `to: "."` on every
 * tile/metric, not omitted -- see getSalesOrdersOverviewConfig's own comment
 * for why.
 */
export function getInvoicesOverviewConfig(kpis) {
  // hasBalanceOnly matters here -- every tile below also requires
  // (total_amount_myr - paid_to_date) > 0.01 in get_invoices_overview_rpc.sql,
  // so without it the drill-through list would include open invoices already
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
      icon: FileTextIcon,
      label: "Outstanding Invoices",
      value: compactCurrency(kpis.outstandingValue),
      variant: "blueCardFill",
      to: ".",
      filter: baseFilter,
      metrics: [
        {
          label: "Invoices",
          value: kpis.outstandingCount,
          to: ".",
          filter: baseFilter,
        },
      ],
      title: `Outstanding balance across open invoices, as of today — ${compactCurrency(kpis.outstandingValue)}`,
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
          label: "Invoices",
          value: kpis.dueSoonCount,
          to: ".",
          filter: dueSoonFilter,
        },
      ],
      title: `Open invoices due within the next 7 days — ${compactCurrency(kpis.dueSoonValue)}`,
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
          label: "Invoices",
          value: kpis.overdueCount,
          to: ".",
          filter: overdueFilter,
        },
      ],
      title: `Open invoices past their due date, as of today — ${compactCurrency(kpis.overdueValue)}`,
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
          label: "Invoices",
          value: kpis.criticallyOverdueCount,
          to: ".",
          filter: criticallyOverdueFilter,
        },
      ],
      title: `Open invoices 90+ days past due, as of today — ${compactCurrency(kpis.criticallyOverdueValue)}`,
    },
  ];
}

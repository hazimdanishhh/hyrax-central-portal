import {
  FileTextIcon,
  ClockIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";

/**
 * Three tiles (Outstanding / Due Soon / Overdue), same two-tier RM+count
 * shape as FinancialReports.jsx's own "Overdue Risk"/"Outstanding AR" tiles
 * -- this is the same underlying figure, just scoped to this list page
 * instead of the full dashboard. `to: "."` on every tile/metric, not
 * omitted -- see getSalesOrdersOverviewConfig's own comment for why.
 */
export function getInvoicesOverviewConfig(kpis) {
  const baseFilter = { statusCode: "O", isCancelled: "N" };
  const dueSoonFilter = { ...baseFilter, dueSoonOnly: "true" };
  const overdueFilter = { ...baseFilter, overdueOnly: "true" };

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
  ];
}

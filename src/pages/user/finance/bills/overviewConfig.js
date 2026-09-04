import {
  InvoiceIcon,
  ClockIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";

/**
 * AP mirror of finance/invoices/overviewConfig.js -- same three-tile shape
 * (Outstanding / Due Soon / Overdue), same reasoning throughout.
 */
export function getBillsOverviewConfig(kpis) {
  const baseFilter = { statusCode: "O", isCancelled: "N" };
  const dueSoonFilter = { ...baseFilter, dueSoonOnly: "true" };
  const overdueFilter = { ...baseFilter, overdueOnly: "true" };

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
  ];
}

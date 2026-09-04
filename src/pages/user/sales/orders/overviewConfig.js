import { ReceiptIcon, ClockIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";

/**
 * Three tiles (Open / Due Soon / Overdue), each RM headline + count
 * sub-metric -- same two-tier shape as FinancialReports.jsx's own
 * "Overdue Risk" tile, not the flatter counts-only style Projects/Users use,
 * since here both the RM value and the count matter equally. `to: "."` on
 * every tile/metric, not omitted -- OverviewCards' own resolveLinkTo
 * defaults an omitted `to` to "../list", which isn't a real route for this
 * page (it IS the list), so that default would silently 404.
 */
export function getSalesOrdersOverviewConfig(kpis) {
  const baseFilter = { statusCode: "O", isCancelled: "N" };
  const dueSoonFilter = { ...baseFilter, dueSoonOnly: "true" };
  const overdueFilter = { ...baseFilter, overdueOnly: "true" };

  return [
    {
      icon: ReceiptIcon,
      label: "Open Orders",
      sublabel: "Total Value, Open Orders",
      value: compactCurrency(kpis.openValue),
      variant: "blueCardFill",
      to: ".",
      filter: baseFilter,
      metrics: [
        { label: "Orders", value: kpis.openCount, to: ".", filter: baseFilter },
      ],
      title: `Open sales orders, as of today — ${compactCurrency(kpis.openValue)}`,
    },
    {
      icon: ClockIcon,
      label: "Due for Delivery Soon",
      sublabel: "Next 7 Days",
      value: compactCurrency(kpis.dueSoonValue),
      variant: kpis.dueSoonCount > 0 ? "yellowCard" : "greenCard",
      to: ".",
      filter: dueSoonFilter,
      metrics: [
        { label: "Orders", value: kpis.dueSoonCount, to: ".", filter: dueSoonFilter },
      ],
      title: `Open orders due for delivery in the next 7 days — ${compactCurrency(kpis.dueSoonValue)}`,
    },
    {
      icon: WarningCircleIcon,
      label: "Overdue for Delivery",
      sublabel: "Past Requested Delivery Date",
      value: compactCurrency(kpis.overdueValue),
      variant: kpis.overdueCount > 0 ? "redCard" : "greenCard",
      to: ".",
      filter: overdueFilter,
      metrics: [
        { label: "Orders", value: kpis.overdueCount, to: ".", filter: overdueFilter },
      ],
      title: `Open orders past their requested delivery date — ${compactCurrency(kpis.overdueValue)}`,
    },
  ];
}

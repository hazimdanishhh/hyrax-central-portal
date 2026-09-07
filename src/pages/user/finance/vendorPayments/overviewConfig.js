import {
  HandCoinsIcon,
  ClockIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";

/**
 * AP mirror of finance/payments/overviewConfig.js -- same three-tile shape
 * (Unallocated Cash / This Week / This Month), same reasoning throughout.
 */
export function getVendorPaymentsOverviewConfig(kpis) {
  // isCancelled: "N" matters here -- get_vendor_payments_overview_rpc.sql's
  // base_vendor_payments CTE excludes cancelled payments (SAP doesn't
  // always zero out a cancelled payment's unallocated_amount), so without
  // this the drill-through list would include cancelled rows the KPI never
  // counted.
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
      icon: HandCoinsIcon,
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
      title: `Cash paid but not yet applied to any bill, as of today — ${compactCurrency(kpis.unallocatedValue)}`,
    },
    {
      icon: ClockIcon,
      label: "Paid This Week",
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
      title: `Vendor payments made in the last 7 days — ${compactCurrency(kpis.thisWeekValue)}`,
    },
    {
      icon: CalendarBlankIcon,
      label: "Paid This Month",
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
      title: `Vendor payments made this month, month to date — ${compactCurrency(kpis.thisMonthValue)}`,
    },
  ];
}

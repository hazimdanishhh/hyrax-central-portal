import {
  StackIcon,
  HandCoinsIcon,
  ClockIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../functions/formatNumber";
import { toLocalDateString } from "../../../../functions/dateRangeFilters";

/**
 * AP mirror of finance/payments/overviewConfig.js -- same four-tile shape
 * (Total, then Unallocated Cash / This Week / This Month), same reasoning
 * throughout.
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
    startDate: toLocalDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    endDate: toLocalDateString(new Date()),
  };
  const now = new Date();
  const thisMonthFilter = {
    isCancelled: "N",
    startDate: toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: toLocalDateString(now),
  };

  return [
    {
      // Total (added 2026-09): total_amount_myr across every vendor payment
      // matching the CURRENT filters -- including unallocatedOnly, which the
      // tile below deliberately never reacts to (see
      // get_vendor_payments_overview_rpc.sql's totals_scope comment). No
      // `to`/`filter`: see finance/invoices/overviewConfig.js's own comment
      // for why -- same deliberate exception to DASHBOARD-CONVENTIONS.md
      // §2a.
      icon: StackIcon,
      label: "Total Vendor Payments",
      value: compactCurrency(kpis.totalValue),
      variant: "blueCardFill",
      to: null,
      metrics: [{ label: "Payments", value: kpis.totalCount }],
      title: `Total paid across every vendor payment matching the current filters — ${compactCurrency(kpis.totalValue)}`,
    },
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

// src/pages/user/sales/reports/tabs/OrdersTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ArrowsLeftRightIcon,
  ChartLineUpIcon,
  FileTextIcon,
  PackageIcon,
  ReceiptIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import { MEASURE_COLORS } from "../../../../../components/chartCard/chartColors";
import { preciseCurrency } from "../../../../../functions/formatNumber";
import {
  formatDateRange,
  formatMonthTick,
  shapeTrendRows,
} from "../../../../../functions/periodRange";
import { useSalesReportTab } from "../../../../../features/sales/reports/private/hooks/useSalesReportTab";
import ReportSection from "../../../../../components/report/ReportSection";
import TabState from "../../../../../components/report/TabState";
import {
  calcDelta,
  comparedWith,
  deltaText,
  lastYearMetric,
  periodLinkFilter,
  repLinkFilter,
  actionTileStatus,
  todayTile,
  trendSubtitle,
} from "../../../../../functions/reportFormat";

/**
 * ORDERS -- bookings and the order book. Data: get_sales_orders. Rules:
 * DASHBOARD-CONVENTIONS §8.
 *
 *   Sales Order KPIs    Sales Orders and the Order-to-Invoice Ratio (period)
 *                       | Open Backlog (TODAY)
 *   Sales Order Trend   Sales Orders vs Invoiced Revenue, monthly
 *   Open Backlog        TODAY: Overdue Delivery, Delivered Not Invoiced (the
 *                       hand-off to Invoicing)
 *   Sales Order Breakdown  who ordered, in the period
 *
 * The order book uses the Orders page's own rules (sales_order_book_facts),
 * so the two agree, and every backlog tile links there. It is an open
 * balance: always today's whole backlog, never narrowed to the period, no
 * previous-period comparison (R3). The orders to chase one by one stay on
 * the Orders page.
 */
export default function OrdersTab() {
  const { filters, period, access, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, isUpdating, error } = useSalesReportTab("orders", filters);

  const against = comparedWith(meta, period);
  const periodFilter = periodLinkFilter(meta);
  const repFilter = repLinkFilter(meta);
  const ordersLink = access.orders ? "/app/sales/orders/all" : null;
  const recent = kpis.recentWindow;
  const recentLabel = recent ? formatDateRange(recent.startDate, recent.endDate) : "";

  const salesOrderKpis = [
    {
      icon: FileTextIcon,
      label: "Sales Orders",
      sublabel: period.title,
      value: preciseCurrency(kpis.booked),
      subvalue: deltaText(calcDelta(kpis.booked, kpis.prevBooked), against),
      variant: "blueCard",
      to: ordersLink,
      filter: { ...repFilter, ...periodFilter },
      metrics: [
        { label: "Order Count", value: kpis.orderCount ?? 0 },
        {
          label: "Avg Order Value",
          value: kpis.avgOrderValue == null ? "—" : preciseCurrency(kpis.avgOrderValue),
        },
        { label: "Customers Ordering", value: kpis.orderingCustomers ?? 0 },
        lastYearMetric(meta, kpis.booked, kpis.lastYearBooked, preciseCurrency),
      ],
      title: "Sales orders placed in the period, not cancelled. Same figure as on Summary.",
    },
    {
      icon: ArrowsLeftRightIcon,
      label: "Order-to-Invoice Ratio",
      sublabel: period.title,
      value: kpis.bookToBill == null ? "—" : `${kpis.bookToBill}×`,
      subvalue: kpis.prevBookToBill == null ? "" : `${kpis.prevBookToBill}× ${against}`,
      variant: "blueCard",
      to: null,
      // Not "Sales Orders" again: its neighbour already shows it (R11).
      metrics: [
        { label: "Invoiced Revenue", value: preciseCurrency(kpis.invoiced) },
        {
          label: "Last 3 Months",
          value: kpis.recentBookToBill == null ? "—" : `${kpis.recentBookToBill}×`,
          title: recentLabel,
        },
      ],
      title:
        "Sales Orders ÷ Invoiced Revenue in the same period. Above 1× the Open Backlog " +
        "is growing (more ordered than invoiced); below 1× it is being worked down. " +
        "Neither is good or bad on its own. One month of orders is volatile, so the last " +
        "3 complete months are shown beside it.",
    },
    todayTile({
      icon: PackageIcon,
      label: "Open Backlog",
      value: preciseCurrency(kpis.orderBookValue),
      variant: "blueCard",
      to: ordersLink,
      filter: { ...repFilter, isCancelled: "N", statusCode: "O", deliveryStatus: "open" },
      metrics: [
        { label: "Orders", value: kpis.orderBookOrders ?? 0 },
        {
          label: "Open Backlog (Months)",
          value: kpis.openBacklogMonths == null ? "—" : `${kpis.openBacklogMonths}`,
          title:
            `Open Backlog ÷ average monthly Invoiced Revenue over the last 3 complete ` +
            `months (${preciseCurrency(kpis.recentMonthlyInvoiced)} a month${
              recentLabel ? `, ${recentLabel}` : ""
            }).`,
        },
      ],
      title:
        "Sales orders still open in SAP and not fully delivered (full order value), right " +
        "now, whatever period is picked. Same rule as the Orders page. Open Backlog " +
        "(Months) is how many months of invoicing that represents at the recent pace.",
    }),
  ];

  const openBacklogKpis = [
    todayTile({
      icon: WarningCircleIcon,
      label: "Overdue Delivery",
      value: preciseCurrency(kpis.overdueValue),
      ...actionTileStatus(kpis.overdueOrders),
      to: ordersLink,
      filter: { ...repFilter, isCancelled: "N", statusCode: "O", deliveryOverdueOnly: "true" },
      metrics: [{ label: "Orders", value: kpis.overdueOrders ?? 0 }],
      title:
        "Open sales orders whose delivery date has passed, right now. Same rule as the " +
        "Orders page. Green when there are none, amber (Watch) when there are any.",
    }),
    todayTile({
      icon: ReceiptIcon,
      label: "Delivered, Not Invoiced",
      value: preciseCurrency(kpis.unbilledValue),
      ...actionTileStatus(kpis.unbilledOrders),
      to: ordersLink,
      filter: { ...repFilter, isCancelled: "N", deliveryStatus: "delivered", invoicedOnly: "none" },
      metrics: [{ label: "Orders", value: kpis.unbilledOrders ?? 0 }],
      title:
        "Sales orders fully delivered with no invoice yet, right now: the hand-off to " +
        "Invoicing. Same rule as the Orders page. Green when there are none, amber (Watch) when there are any.",
    }),
  ];

  const ordersVsInvoiced = shapeTrendRows(
    data?.ordersVsInvoiced ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Sales Orders": d.booked, "Invoiced Revenue": d.invoiced }),
  );
  const topCustomers = (data?.topCustomers ?? []).map((c) => ({
    name: c.name,
    value: c.value,
  }));

  return (
    <TabState isLoading={isLoading} isUpdating={isUpdating} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={FileTextIcon}
        title="Sales Order KPIs"
        description={`${period.title}, sales orders placed and how they compare with invoicing; and today, the open backlog.`}
      >
        <OverviewCards items={salesOrderKpis} />
      </ReportSection>

      <ReportSection
        icon={ChartLineUpIcon}
        title="Sales Order Trend"
        description="Sales Orders against Invoiced Revenue by month."
      >
        <CardLayout>
          <ChartCard
            title="Sales Orders vs Invoiced Revenue (RM)"
            subtitle={trendSubtitle(meta, period, ordersVsInvoiced)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={ordersVsInvoiced.data}
              highlight={ordersVsInvoiced.highlight}
              lines={[
                { dataKey: "Sales Orders", color: MEASURE_COLORS.salesOrders },
                { dataKey: "Invoiced Revenue", color: MEASURE_COLORS.invoicedRevenue },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={PackageIcon}
        title="Open Backlog"
        description="Today: open orders already late for delivery, and delivered orders not yet invoiced."
      >
        <OverviewCards items={openBacklogKpis} />
      </ReportSection>

      <ReportSection
        icon={UsersThreeIcon}
        title="Sales Order Breakdown"
        description={`${period.title}, the customers placing the most sales orders.`}
      >
        <CardLayout>
          <ChartCard
            title="Top Customers by Sales Orders (RM)"
            subtitle={`Top 10, ${period.title}`}
            style="cardGapSmall"
            viewAllTo={ordersLink ?? undefined}
            viewAllFilter={{ ...repFilter, ...periodFilter }}
          >
            {topCustomers.length ? (
              <HorizontalBarChartRenderer data={topCustomers} colorMap={MEASURE_COLORS.salesOrders} />
            ) : (
              <NoResult title="No sales orders in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

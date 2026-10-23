// src/pages/user/sales/reports/tabs/OrdersTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ArrowsLeftRightIcon,
  CalendarIcon,
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
import {
  GREEN_COLOR,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import { preciseCurrency } from "../../../../../functions/formatNumber";
import {
  formatMonthTick,
  shapeTrendRows,
} from "../../../../../functions/periodRange";
import { useSalesReportTab } from "../../../../../features/sales/reports/private/hooks/useSalesReportTab";
import ReportSection from "./ReportSection";
import TabState from "./TabState";
import {
  calcDelta,
  comparedWith,
  deltaText,
  lastYearMetric,
  periodLinkFilter,
  repLinkFilter,
  trendSubtitle,
} from "./reportFormat";

/**
 * ORDERS -- bookings and the order book. Data: get_sales_orders.
 *
 * For meetings: how much was booked, is billing keeping up (book-to-bill),
 * and how much is waiting -- the order book. The orders to chase today stay
 * on the Orders page; the order book tile here uses that page's own rules
 * (sales_order_book_facts), so the two agree, and links to it.
 *
 * Order Book is ACTIONABLE (DASHBOARD-CONVENTIONS §4b): the whole current
 * backlog with no period picked, orders placed in the period once one is.
 */
export default function OrdersTab() {
  const { filters, period, access, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, error } = useSalesReportTab("orders", filters);

  const against = comparedWith(meta, period);
  const periodFilter = periodLinkFilter(meta);
  const repFilter = repLinkFilter(meta);
  const hasPeriod = Boolean(meta?.period?.hasPeriod);
  const bookLabel = hasPeriod ? `Placed ${period.title}` : "Current backlog";
  const ordersLink = access.orders ? "/app/sales/orders/all" : null;

  const backlogFilter = hasPeriod ? periodFilter : {};

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
      subvalue:
        kpis.prevBookToBill == null ? "" : `${kpis.prevBookToBill}× ${against}`,
      variant: "blueCard",
      to: null,
      metrics: [
        { label: "Sales Orders", value: preciseCurrency(kpis.booked) },
        { label: "Invoiced Revenue", value: preciseCurrency(kpis.invoiced) },
      ],
      title:
        "Sales Orders ÷ Invoiced Revenue in the same period. Above 1× the Open Backlog " +
        "is growing (more ordered than invoiced); below 1× it is being worked down. " +
        "Neither is good or bad on its own.",
    },
  ];

  const openBacklogKpis = [
    {
      icon: PackageIcon,
      label: "Open Backlog",
      sublabel: bookLabel,
      value: preciseCurrency(kpis.orderBookValue),
      variant: "blueCard",
      to: ordersLink,
      filter: {
        ...repFilter,
        isCancelled: "N",
        statusCode: "O",
        deliveryStatus: "open",
        ...backlogFilter,
      },
      metrics: [{ label: "Orders", value: kpis.orderBookOrders ?? 0 }],
      title:
        "Sales orders still open in SAP and not fully delivered (full order value). " +
        "Same rule as the Orders page. With no period picked this is the whole current " +
        "backlog; once a period is picked, orders placed in it.",
    },
    {
      icon: CalendarIcon,
      label: "Open Backlog (Months)",
      sublabel: "At the last 3 months' invoicing",
      value: kpis.openBacklogMonths == null ? "—" : `${kpis.openBacklogMonths}`,
      variant: "blueCard",
      to: null,
      metrics: [
        { label: "Open Backlog", value: preciseCurrency(kpis.orderBookValue) },
        {
          label: "Avg Monthly Invoiced Revenue",
          value:
            kpis.recentMonthlyInvoiced == null
              ? "—"
              : preciseCurrency(kpis.recentMonthlyInvoiced),
        },
      ],
      title:
        "How many months of invoicing the Open Backlog represents: Open Backlog ÷ the " +
        "average monthly Invoiced Revenue over the last 3 complete months.",
    },
    {
      icon: WarningCircleIcon,
      label: "Overdue Delivery",
      sublabel: bookLabel,
      value: preciseCurrency(kpis.overdueValue),
      variant: (kpis.overdueOrders ?? 0) > 0 ? "yellowCard" : "blueCard",
      to: ordersLink,
      filter: {
        ...repFilter,
        isCancelled: "N",
        statusCode: "O",
        deliveryOverdueOnly: "true",
        ...backlogFilter,
      },
      metrics: [{ label: "Orders", value: kpis.overdueOrders ?? 0 }],
      title:
        "Open sales orders whose delivery date has passed. Same rule as the Orders page. " +
        "Amber when there are any.",
    },
    {
      icon: ReceiptIcon,
      label: "Delivered, Not Invoiced",
      sublabel: bookLabel,
      value: preciseCurrency(kpis.unbilledValue),
      variant: (kpis.unbilledOrders ?? 0) > 0 ? "yellowCard" : "blueCard",
      to: ordersLink,
      filter: {
        ...repFilter,
        isCancelled: "N",
        deliveryStatus: "delivered",
        invoicedOnly: "none",
        ...backlogFilter,
      },
      metrics: [{ label: "Orders", value: kpis.unbilledOrders ?? 0 }],
      title:
        "Sales orders fully delivered with no invoice yet: the hand-off to Invoicing. " +
        "Same rule as the Orders page. Amber when there are any.",
    },
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
    <TabState isLoading={isLoading} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={FileTextIcon}
        title="Sales Order KPIs"
        description={`${period.title}, sales orders placed and how they compare with invoicing.`}
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
                { dataKey: "Sales Orders", color: YELLOW_COLOR },
                { dataKey: "Invoiced Revenue", color: GREEN_COLOR },
              ]}
            />
          </ChartCard>
        </CardLayout>
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
              <HorizontalBarChartRenderer data={topCustomers} colorMap={YELLOW_COLOR} />
            ) : (
              <NoResult title="No sales orders in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={PackageIcon}
        title="Open Backlog"
        description={`${bookLabel}: sales orders not yet delivered or invoiced.`}
      >
        <OverviewCards items={openBacklogKpis} />
      </ReportSection>
    </TabState>
  );
}

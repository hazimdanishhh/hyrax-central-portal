// src/pages/user/sales/reports/tabs/OrdersTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ArrowsLeftRightIcon,
  FileTextIcon,
  PackageIcon,
  UsersThreeIcon,
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
  const bookLabel = hasPeriod ? `Orders placed ${period.title}` : "Current backlog";
  const ordersLink = access.orders ? "/app/sales/orders/all" : null;

  const tiles = [
    {
      icon: FileTextIcon,
      label: "Orders Booked",
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
      ],
      title: "Sales orders booked in the period, not cancelled. Same figure as on Summary.",
    },
    {
      icon: ArrowsLeftRightIcon,
      label: "Book-to-Bill",
      sublabel: period.title,
      value: kpis.bookToBill == null ? "—" : `${kpis.bookToBill}×`,
      subvalue:
        kpis.prevBookToBill == null ? "" : `${kpis.prevBookToBill}× ${against}`,
      variant: "blueCard",
      to: null,
      metrics: [
        { label: "Booked", value: preciseCurrency(kpis.booked) },
        { label: "Invoiced", value: preciseCurrency(kpis.invoiced) },
      ],
      title:
        "Orders booked ÷ revenue invoiced in the same period. Above 1× the order book " +
        "is growing (more coming in than going out as invoices); below 1× it is being " +
        "worked down. Neither is good or bad on its own.",
    },
    {
      icon: PackageIcon,
      label: "Order Book",
      sublabel: bookLabel,
      value: preciseCurrency(kpis.orderBookValue),
      variant: (kpis.overdueOrders ?? 0) > 0 ? "yellowCard" : "blueCard",
      to: ordersLink,
      filter: {
        ...repFilter,
        isCancelled: "N",
        statusCode: "O",
        deliveryStatus: "open",
        ...(hasPeriod ? periodFilter : {}),
      },
      metrics: [
        {
          label: "Open Orders",
          value: kpis.orderBookOrders ?? 0,
        },
        {
          label: "Overdue Delivery",
          value: `${kpis.overdueOrders ?? 0} · ${preciseCurrency(kpis.overdueValue)}`,
          to: ordersLink,
          filter: {
            ...repFilter,
            isCancelled: "N",
            statusCode: "O",
            deliveryOverdueOnly: "true",
            ...(hasPeriod ? periodFilter : {}),
          },
        },
        {
          label: "Delivered, Not Invoiced",
          value: `${kpis.unbilledOrders ?? 0} · ${preciseCurrency(kpis.unbilledValue)}`,
          to: ordersLink,
          filter: {
            ...repFilter,
            isCancelled: "N",
            deliveryStatus: "delivered",
            invoicedOnly: "none",
            ...(hasPeriod ? periodFilter : {}),
          },
        },
      ],
      title:
        "Orders still open in SAP and not fully delivered (full order value), with how " +
        "many are past their delivery date, and orders delivered but not yet invoiced. " +
        "Same rules as the Orders page. With no period picked this is the whole current " +
        "backlog; once a period is picked, orders placed in it. Amber when any delivery " +
        "is overdue.",
    },
  ];

  const ordersVsInvoiced = shapeTrendRows(
    data?.ordersVsInvoiced ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Orders Booked": d.booked, Invoiced: d.invoiced }),
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
        title="Bookings and the order book"
        description={`${period.title} — what was booked, whether billing is keeping up, and what is waiting.`}
      >
        <OverviewCards items={tiles} />

        <CardLayout>
          <ChartCard
            title="Orders Booked vs Invoiced (RM)"
            subtitle={trendSubtitle(meta, period, ordersVsInvoiced)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={ordersVsInvoiced.data}
              highlight={ordersVsInvoiced.highlight}
              lines={[
                { dataKey: "Orders Booked", color: YELLOW_COLOR },
                { dataKey: "Invoiced", color: GREEN_COLOR },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={UsersThreeIcon}
        title="Who is ordering"
        description="The customers placing the most business this period."
      >
        <CardLayout>
          <ChartCard
            title="Top Customers by Orders Booked (RM)"
            subtitle={`Top 10, ${period.title}`}
            style="cardGapSmall"
            viewAllTo={ordersLink ?? undefined}
            viewAllFilter={{ ...repFilter, ...periodFilter }}
          >
            {topCustomers.length ? (
              <HorizontalBarChartRenderer data={topCustomers} colorMap={YELLOW_COLOR} />
            ) : (
              <NoResult title="No orders in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

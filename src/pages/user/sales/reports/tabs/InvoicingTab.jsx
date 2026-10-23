// src/pages/user/sales/reports/tabs/InvoicingTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ChartLineUpIcon,
  PackageIcon,
  ReceiptIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../../components/chartCard/HorizontalMultiBarRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  PURPLE_COLOR,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import {
  compactCurrency,
  preciseCurrency,
} from "../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../functions/statusVariant";
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

const pctOrDash = (v) => (v === null || v === undefined ? "—" : `${v}%`);

/**
 * INVOICING -- billings: invoiced revenue against budget, and who and what
 * it comes from. Data: get_sales_invoicing. Invoiced Revenue is the same
 * figure as on Summary (same function, same definition); the rest breaks it
 * down. Bookings and the order book are on the Orders tab.
 *
 * Product figures are PRODUCT SALES (BEFORE TAX): invoice lines exclude tax,
 * so they are never shown under the same name as Invoiced Revenue (which
 * includes it), and Product Concentration's share is lines over lines.
 */
export default function InvoicingTab() {
  const { filters, period, access, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, error } = useSalesReportTab("invoicing", filters);

  const against = comparedWith(meta, period);
  const periodFilter = periodLinkFilter(meta);
  const repFilter = repLinkFilter(meta);

  const budgetStatus = getStatusVariant(kpis.budgetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: { warningAt: 70, goodAt: 95 },
  });
  const customerStatus = getStatusVariant(kpis.customerTop5Pct ?? null, {
    direction: "low-good",
    thresholds: { warningAt: 50, criticalAt: 75 },
  });
  const productStatus = getStatusVariant(kpis.productTop5Pct ?? null, {
    direction: "low-good",
    thresholds: { warningAt: 45, criticalAt: 75 },
  });

  const invoiceKpis = [
    {
      icon: ReceiptIcon,
      label: "Invoiced Revenue",
      sublabel: `${period.title} · vs Revenue Budget`,
      value: preciseCurrency(kpis.invoiced),
      delta: pctOrDash(kpis.budgetAttainmentPct),
      subvalue: deltaText(calcDelta(kpis.invoiced, kpis.prevInvoiced), against),
      variant: budgetStatus.variant,
      status: budgetStatus.statusIcon
        ? { icon: budgetStatus.statusIcon, label: budgetStatus.statusLabel }
        : undefined,
      to: access.invoices ? "/app/finance/invoices/list" : null,
      filter: { ...repFilter, ...periodFilter },
      metrics: [
        {
          label: "Revenue Budget",
          value: kpis.budget == null ? "none set" : preciseCurrency(kpis.budget),
          to: "/app/sales/orders/budgets",
          filter: { ...repFilter },
        },
        { label: "Invoice Count", value: kpis.invoiceCount ?? 0 },
        {
          label: "Avg Invoice Value",
          value: kpis.avgInvoiceValue == null ? "—" : preciseCurrency(kpis.avgInvoiceValue),
        },
        lastYearMetric(meta, kpis.invoiced, kpis.lastYearInvoiced, preciseCurrency),
      ],
      title:
        "A/R invoices in the period, not cancelled, including tax, against the Revenue " +
        "Budget for the same days. Same figure as on Summary. " +
        "Colour: Critical below 70% of budget, Watch 70–94%, On track at 95%+.",
    },
    {
      icon: UsersThreeIcon,
      label: "Customer Concentration",
      sublabel: `Top 5 customers' share, ${period.title}`,
      value: pctOrDash(kpis.customerTop5Pct),
      variant: customerStatus.variant,
      status: customerStatus.statusIcon
        ? { icon: customerStatus.statusIcon, label: customerStatus.statusLabel }
        : undefined,
      to: null,
      metrics: [
        {
          label: "Top Customer",
          value: kpis.topCustomerName
            ? `${kpis.topCustomerName} (${pctOrDash(kpis.topCustomerPct)})`
            : "—",
        },
      ],
      title:
        "Share of Invoiced Revenue from the five biggest customers. Colour: Watch at " +
        "50%+, Critical at 75%+.",
    },
    {
      icon: PackageIcon,
      label: "Product Concentration",
      sublabel: `Top 5 products' share, ${period.title}`,
      value: pctOrDash(kpis.productTop5Pct),
      variant: productStatus.variant,
      status: productStatus.statusIcon
        ? { icon: productStatus.statusIcon, label: productStatus.statusLabel }
        : undefined,
      to: null,
      metrics: [
        {
          label: "Top Product",
          value: kpis.topProductName
            ? `${kpis.topProductName} (${pctOrDash(kpis.topProductPct)})`
            : "—",
        },
        {
          label: "Top Group",
          value: kpis.topGroupName
            ? `${kpis.topGroupName} (${pctOrDash(kpis.topGroupPct)})`
            : "—",
        },
      ],
      title:
        "Share of product sales (invoice lines, before tax) from the five biggest " +
        "products, and the biggest product group. Colour: Watch at 45%+, Critical at 75%+.",
    },
  ];

  const invoicedVsBudget = shapeTrendRows(
    data?.invoicedVsBudget ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Invoiced Revenue": d.invoiced, "Revenue Budget": d.budget }),
  );

  const topCustomers = (data?.topCustomers ?? []).map((c) => ({
    name: c.name ?? c.customerCode,
    "Invoiced Revenue": c.invoiced,
    "Payments Collected": c.collected,
  }));
  const topProducts = (data?.topProducts ?? []).map((p) => ({
    name: p.name,
    value: p.sales,
  }));
  const productGroups = (data?.productGroups ?? []).map((g) => ({
    name: g.name,
    value: g.sales,
  }));
  const exportLocal = data?.exportLocal ?? [];

  return (
    <TabState isLoading={isLoading} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={ReceiptIcon}
        title="Invoice KPIs"
        description={`${period.title}, Invoiced Revenue against Revenue Budget, and customer and product concentration.`}
      >
        <OverviewCards items={invoiceKpis} />
      </ReportSection>

      <ReportSection
        icon={ChartLineUpIcon}
        title="Invoice Trend"
        description="Invoiced Revenue against Revenue Budget by month."
      >
        <CardLayout>
          <ChartCard
            title="Invoiced Revenue vs Budget (RM)"
            subtitle={trendSubtitle(meta, period, invoicedVsBudget)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={invoicedVsBudget.data}
              highlight={invoicedVsBudget.highlight}
              lines={[
                { dataKey: "Invoiced Revenue", color: BLUE_COLOR },
                { dataKey: "Revenue Budget", color: YELLOW_COLOR },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={UsersThreeIcon}
        title="Invoice Breakdown"
        description={`${period.title}, Invoiced Revenue by customer and classification; product sales (before tax) by product and group.`}
      >
        <CardLayout style="cardLayout2">
          <ChartCard
            title="Top Customers by Invoiced Revenue (RM)"
            subtitle={`Top 10, ${period.title} · with what they paid in the same period`}
            style="cardGapSmall"
            viewAllTo={access.invoices ? "/app/finance/invoices/list" : undefined}
            viewAllFilter={{ ...repFilter, ...periodFilter }}
          >
            {topCustomers.length ? (
              <HorizontalMultiBarRenderer
                data={topCustomers}
                bars={[
                  { dataKey: "Invoiced Revenue", name: "Invoiced Revenue", color: YELLOW_COLOR },
                  { dataKey: "Payments Collected", name: "Payments Collected", color: GREEN_COLOR },
                ]}
              />
            ) : (
              <NoResult title="No invoices in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Revenue by Export / Local (RM)"
            subtitle={`By customer classification, ${period.title}`}
            style="cardGapSmall"
          >
            {exportLocal.length ? (
              <PieChartRenderer
                data={exportLocal}
                mode="semantic"
                colorMap={{
                  Export: BLUE_COLOR,
                  Local: GREEN_COLOR,
                  Unspecified: "#9ca3af",
                }}
                centerLabel="total"
                centerSubLabel="Invoiced Revenue"
                centerFormatter={compactCurrency}
                valueFormatter={preciseCurrency}
                sliceLabel="percent"
              />
            ) : (
              <NoResult title="No invoices in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Top Products — Sales Before Tax (RM)"
            subtitle={`Top 10, ${period.title}`}
            style="cardGapSmall"
          >
            {topProducts.length ? (
              <HorizontalBarChartRenderer data={topProducts} colorMap={GREEN_COLOR} />
            ) : (
              <NoResult title="No product sales in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Product Groups — Sales Before Tax (RM)"
            subtitle={`All groups, ${period.title}`}
            style="cardGapSmall"
          >
            {productGroups.length ? (
              <HorizontalBarChartRenderer data={productGroups} colorMap={PURPLE_COLOR} />
            ) : (
              <NoResult title="No product sales in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

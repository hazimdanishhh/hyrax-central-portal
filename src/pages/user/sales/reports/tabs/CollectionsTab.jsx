// src/pages/user/sales/reports/tabs/CollectionsTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ChartLineUpIcon,
  HourglassMediumIcon,
  UsersThreeIcon,
  WalletIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../../components/chartCard/HorizontalMultiBarRenderer";
import {
  GREY_COLOR,
  MEASURE_COLORS,
} from "../../../../../components/chartCard/chartColors";
import { preciseCurrency } from "../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../functions/statusVariant";
import {
  formatMonthTick,
  shapeTrendRows,
} from "../../../../../functions/periodRange";
import { useSalesReportTab } from "../../../../../features/sales/reports/private/hooks/useSalesReportTab";
import ReportSection from "../../../../../components/report/ReportSection";
import TabState from "../../../../../components/report/TabState";
import {
  OVERDUE_SHARE_THRESHOLDS,
  calcDelta,
  comparedWith,
  deltaText,
  lastYearMetric,
  pctText,
  periodLinkFilter,
  repLinkFilter,
  todayTile,
  trendSubtitle,
} from "../../../../../functions/reportFormat";

const INVOICES_LIST = "/app/finance/invoices/list";

/**
 * COLLECTIONS -- is the cash coming in, how much is owed, and how late.
 * Data: get_sales_collections. Rules: DASHBOARD-CONVENTIONS §8.
 *
 *   Payment KPIs        Payments Collected (period) | Outstanding Invoices
 *                       and Overdue (TODAY)
 *   Payment Trend       Invoiced Revenue vs Payments Collected, monthly
 *   Receivables         TODAY: Overdue by Age, Top Overdue Invoices by Customer
 *   Payment Breakdown   who paid, in the period
 *
 * Outstanding and Overdue use FINANCE's open-invoice rule (open in SAP,
 * balance over RM0.01; overdue = past due date; critically overdue = 90+
 * days), so they match Finance -> Invoices for the same rep, and link
 * there with its own filters. They are open balances: always today, never
 * narrowed to the period, no previous-period comparison (R3).
 *
 * Collection Rate was retired (2026-10-23): this period's cash over this
 * period's invoices isn't a standard measure -- customers on 30-60 day terms
 * pay earlier invoices. Aging, Overdue and DSO are the standard set.
 */
export default function CollectionsTab() {
  const { filters, period, access, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, isUpdating, error } = useSalesReportTab("collections", filters);

  const against = comparedWith(meta, period);
  const periodFilter = periodLinkFilter(meta);
  const repFilter = repLinkFilter(meta);
  const invoicesLink = access.invoices ? INVOICES_LIST : null;

  // Nothing outstanding means nothing overdue: 0%, a good reading -- not
  // "no comparator" (the SQL's share is null only because there is nothing
  // to divide by).
  const overduePct =
    kpis.overduePct ?? (kpis.outstanding != null && Number(kpis.outstanding) === 0 ? 0 : null);
  const overdueStatus = getStatusVariant(overduePct, {
    direction: "low-good",
    thresholds: OVERDUE_SHARE_THRESHOLDS,
  });

  const tiles = [
    {
      icon: WalletIcon,
      label: "Payments Collected",
      sublabel: period.title,
      value: preciseCurrency(kpis.collected),
      subvalue: deltaText(calcDelta(kpis.collected, kpis.prevCollected), against),
      variant: "blueCard",
      to: access.payments ? "/app/finance/invoices/payments" : null,
      filter: { ...periodFilter },
      metrics: [
        { label: "Payments", value: kpis.paymentCount ?? 0 },
        { label: "Customers Paying", value: kpis.payingCustomers ?? 0 },
        lastYearMetric(meta, kpis.collected, kpis.lastYearCollected, preciseCurrency),
      ],
      title:
        "Payments received in the period and applied to a customer invoice (deposits and " +
        "unapplied payments excluded). Payments counts receipts. Same figure as on Summary.",
    },
    todayTile({
      icon: HourglassMediumIcon,
      label: "Outstanding Invoices",
      value: preciseCurrency(kpis.outstanding),
      variant: "blueCard",
      to: invoicesLink,
      filter: { ...repFilter, statusCode: "O", hasBalanceOnly: "true" },
      metrics: [
        { label: "Invoices", value: kpis.outstandingInvoices ?? 0 },
        { label: "Customers", value: kpis.outstandingCustomers ?? 0 },
        {
          label: "DSO",
          value: kpis.dso == null ? "—" : `${kpis.dso} days`,
          title:
            "Days Sales Outstanding, Finance's formula: average receivables over the last " +
            "90 days ÷ invoiced revenue in those days × 90.",
        },
      ],
      title:
        "What customers owe right now on invoices still open in SAP (Finance's rule, same " +
        "as Finance → Invoices). An open balance: today's figure whatever period is picked.",
    }),
    todayTile({
      icon: WarningCircleIcon,
      label: "Overdue",
      value: preciseCurrency(kpis.overdueValue),
      delta: pctText(overduePct),
      variant: overdueStatus.variant,
      status: overdueStatus.statusIcon
        ? { icon: overdueStatus.statusIcon, label: overdueStatus.statusLabel }
        : undefined,
      to: invoicesLink,
      filter: { ...repFilter, overdueOnly: "true" },
      metrics: [
        { label: "Overdue Invoices", value: kpis.overdueCount ?? 0 },
        {
          label: "Critically Overdue (90+ days)",
          value: `${preciseCurrency(kpis.criticalValue)} (${kpis.criticalCount ?? 0})`,
          to: invoicesLink,
          filter: { ...repFilter, criticallyOverdueOnly: "true" },
        },
      ],
      title:
        "Open invoices past their due date, today (Finance's rule); the % is the share of " +
        "Outstanding Invoices. Critically Overdue is 90+ days past due. Colour: Watch at " +
        "30%+ overdue, Critical at 50%+.",
    }),
  ];

  const invoicedVsCollected = shapeTrendRows(
    data?.invoicedVsCollected ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Invoiced Revenue": d.invoiced, "Payments Collected": d.collected }),
  );
  // Buckets stay in age order (an ordinal scale, not sorted by size); the
  // not-yet-due money is not late, so it is grey, not red.
  const overdueByAge = (data?.overdueByAge ?? []).map((b, i) => ({
    ...b,
    color: i === 0 ? GREY_COLOR : MEASURE_COLORS.overdue,
  }));
  const topOverdue = (data?.topOverdue ?? []).map((c) => ({
    name: c.name ?? c.customerCode,
    Overdue: c.value,
    "Critically Overdue": c.critical,
  }));
  const topPayers = (data?.topPayers ?? []).map((p) => ({
    name: p.name ?? p.customerCode,
    value: p.value,
  }));

  return (
    <TabState isLoading={isLoading} isUpdating={isUpdating} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={WalletIcon}
        title="Payment KPIs"
        description={`${period.title}, Payments Collected; and today, what is owed and how much of it is late.`}
      >
        <OverviewCards items={tiles} />
      </ReportSection>

      <ReportSection
        icon={ChartLineUpIcon}
        title="Payment Trend"
        description="Invoiced Revenue against Payments Collected by month."
      >
        <CardLayout>
          <ChartCard
            title="Invoiced Revenue vs Payments Collected (RM)"
            subtitle={trendSubtitle(meta, period, invoicedVsCollected)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={invoicedVsCollected.data}
              highlight={invoicedVsCollected.highlight}
              lines={[
                { dataKey: "Invoiced Revenue", color: MEASURE_COLORS.invoicedRevenue },
                { dataKey: "Payments Collected", color: MEASURE_COLORS.paymentsCollected },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={HourglassMediumIcon}
        title="Receivables"
        description="Today: Outstanding Invoices by how far past due they are, and the customers with the most overdue."
      >
        <CardLayout style="cardLayout2">
          <ChartCard
            title="Overdue by Age (RM)"
            subtitle="Today · Outstanding Invoices by days past due"
            style="cardGapSmall"
            viewAllTo={invoicesLink ?? undefined}
            viewAllFilter={{ ...repFilter, overdueOnly: "true" }}
          >
            {overdueByAge.some((b) => Number(b.value) > 0) ? (
              <HorizontalBarChartRenderer data={overdueByAge} colorMap={MEASURE_COLORS.overdue} />
            ) : (
              <NoResult title="Nothing outstanding." />
            )}
          </ChartCard>

          <ChartCard
            title="Top Overdue Invoices by Customer (RM)"
            subtitle="Today · top 10, with the critically overdue part (90+ days)"
            style="cardGapSmall"
            viewAllTo={invoicesLink ?? undefined}
            viewAllFilter={{ ...repFilter, overdueOnly: "true" }}
          >
            {topOverdue.length ? (
              <HorizontalMultiBarRenderer
                data={topOverdue}
                bars={[
                  { dataKey: "Overdue", name: "Overdue", color: MEASURE_COLORS.overdue },
                  { dataKey: "Critically Overdue", name: "Critically Overdue", color: "#8f2f2f" },
                ]}
              />
            ) : (
              <NoResult title="Nothing overdue." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={UsersThreeIcon}
        title="Payment Breakdown"
        description={`${period.title}, the customers who paid the most.`}
      >
        <CardLayout>
          <ChartCard
            title="Top Customers by Payments Collected (RM)"
            subtitle={`Top 10, ${period.title}`}
            style="cardGapSmall"
            viewAllTo={access.payments ? "/app/finance/invoices/payments" : undefined}
            viewAllFilter={{ ...periodFilter }}
          >
            {topPayers.length ? (
              <HorizontalBarChartRenderer data={topPayers} colorMap={MEASURE_COLORS.paymentsCollected} />
            ) : (
              <NoResult title="No payments in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

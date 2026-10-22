// src/pages/user/sales/reports/tabs/CollectionsTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  HourglassMediumIcon,
  PercentIcon,
  WalletIcon,
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
  pctText,
  periodLinkFilter,
  trendSubtitle,
} from "./reportFormat";

/**
 * COLLECTIONS -- is the cash coming in, and who owes us. Data:
 * get_sales_collections. Payments Collected is the same figure as on
 * Summary.
 *
 * Outstanding is ACTIONABLE (DASHBOARD-CONVENTIONS §4b): the whole current
 * backlog until a period is picked, then the open balance on invoices raised
 * in that period. Collection Rate is kept with its caveat (decision D3): it
 * divides this period's cash by this period's invoices, and customers on
 * 30-60 day terms pay LATER invoices.
 */
export default function CollectionsTab() {
  const { filters, period, access, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, error } = useSalesReportTab("collections", filters);

  const against = comparedWith(meta, period);
  const periodFilter = periodLinkFilter(meta);
  const backlogLabel = meta?.period?.hasPeriod
    ? `Invoices raised ${period.title}`
    : "Current backlog";

  const rateStatus = getStatusVariant(kpis.collectionRatePct ?? null, {
    direction: "high-good",
    thresholds: { warningAt: 70, goodAt: 90 },
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
      ],
      title:
        "Cash received in the period and applied to a customer invoice (deposits and " +
        "unapplied cash excluded). Payments counts receipts. Same figure as on Summary.",
    },
    {
      icon: HourglassMediumIcon,
      label: "Outstanding Receivables",
      sublabel: backlogLabel,
      value: preciseCurrency(kpis.outstanding),
      variant: "blueCard",
      to: access.invoices ? "/app/finance/invoices/list" : null,
      filter: {
        hasBalanceOnly: "true",
        ...(meta?.period?.hasPeriod ? periodFilter : {}),
      },
      metrics: [
        { label: "Open Invoices", value: kpis.outstandingInvoices ?? 0 },
        { label: "Customers Owing", value: kpis.outstandingCustomers ?? 0 },
      ],
      title:
        "What customers still owe on uncancelled invoices, right now. With no period " +
        "picked this is the whole backlog, however old; once a period is picked, it is " +
        "the open balance on invoices raised in that period.",
    },
    {
      icon: PercentIcon,
      label: "Collection Rate",
      sublabel: period.title,
      value: pctText(kpis.collectionRatePct),
      variant: rateStatus.variant,
      status: rateStatus.statusIcon
        ? { icon: rateStatus.statusIcon, label: rateStatus.statusLabel }
        : undefined,
      to: null,
      metrics: [
        { label: "Collected", value: preciseCurrency(kpis.collected) },
        { label: "Invoiced", value: preciseCurrency(kpis.invoiced) },
      ],
      title:
        "Cash collected in the period ÷ revenue invoiced in the same period. CAVEAT: " +
        "customers on 30–60 day terms pay earlier invoices, so a healthy month can read " +
        "below 70% and a slow month above it. Read it as a trend, not a verdict. " +
        "Colour: Critical below 70%, Watch 70–89%, On track at 90%+.",
    },
  ];

  const invoicedVsCollected = shapeTrendRows(
    data?.invoicedVsCollected ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ Invoiced: d.invoiced, Collected: d.collected }),
  );
  const topPayers = (data?.topPayers ?? []).map((p) => ({
    name: p.name ?? p.customerCode,
    value: p.value,
  }));
  const topOutstanding = (data?.topOutstanding ?? []).map((p) => ({
    name: p.name ?? p.customerCode,
    value: p.value,
  }));

  return (
    <TabState isLoading={isLoading} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={WalletIcon}
        title="Cash coming in"
        description={`${period.title} — what was collected, and what is still owed.`}
      >
        <OverviewCards items={tiles} />

        <CardLayout>
          <ChartCard
            title="Invoiced vs Collected (RM)"
            subtitle={trendSubtitle(meta, period, invoicedVsCollected)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={invoicedVsCollected.data}
              highlight={invoicedVsCollected.highlight}
              lines={[
                { dataKey: "Invoiced", color: YELLOW_COLOR },
                { dataKey: "Collected", color: GREEN_COLOR },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={HourglassMediumIcon}
        title="Who paid, who owes"
        description="The biggest payers this period, and the biggest open balances."
      >
        <CardLayout style="cardLayout2">
          <ChartCard
            title="Top Customers by Payments Collected (RM)"
            subtitle={`Top 10, ${period.title}`}
            style="cardGapSmall"
            viewAllTo={access.payments ? "/app/finance/invoices/payments" : undefined}
            viewAllFilter={{ ...periodFilter }}
          >
            {topPayers.length ? (
              <HorizontalBarChartRenderer data={topPayers} colorMap={GREEN_COLOR} />
            ) : (
              <NoResult title="No payments in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Top Outstanding by Customer (RM)"
            subtitle={`Top 10, ${backlogLabel}`}
            style="cardGapSmall"
            viewAllTo={access.invoices ? "/app/finance/invoices/list" : undefined}
            viewAllFilter={{ hasBalanceOnly: "true" }}
          >
            {topOutstanding.length ? (
              <HorizontalBarChartRenderer data={topOutstanding} colorMap="#ef4444" />
            ) : (
              <NoResult title="Nothing outstanding." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

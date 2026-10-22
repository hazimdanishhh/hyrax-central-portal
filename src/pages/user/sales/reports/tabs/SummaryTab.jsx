// src/pages/user/sales/reports/tabs/SummaryTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ChartLineUpIcon,
  FileTextIcon,
  GaugeIcon,
  GlobeHemisphereEastIcon,
  ReceiptIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import VerticalMultiBarRenderer from "../../../../../components/chartCard/VerticalMultiBarRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  PURPLE_COLOR,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import { preciseCurrency } from "../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../functions/statusVariant";
import {
  fiscalYearStartYear,
  formatMonthTick,
  shapeTrendRows,
} from "../../../../../functions/periodRange";
import { useSalesReportTab } from "../../../../../features/sales/reports/private/hooks/useSalesReportTab";
import { useSalesProjections } from "../../../../../features/sales/reports/private/hooks/useSalesProjections";
import { getSalesProjectionsConfig } from "../config/projectionConfig";
import ReportSection from "./ReportSection";
import TabState from "./TabState";
import {
  calcDelta,
  comparedWith,
  deltaText,
  pctText,
  repLinkFilter,
  trendSubtitle,
} from "./reportFormat";

/**
 * SUMMARY -- for weekly / monthly meetings: are we on track, where is the
 * gap, are we growing. Data: get_sales_summary (+ get_sales_projections for
 * the FY Outlook tile). Plan: docs/sales/SALES-REPORTS-TABS-PLAN.md §3.
 *
 * The four headline tiles all respond to the same two filters, so they sit
 * in one row. FY Outlook doesn't (it's company-wide), so it gets a row of
 * its own that says so (DASHBOARD-CONVENTIONS "the test": a figure that
 * ignores a filter its neighbours respond to is not their peer).
 */
export default function SummaryTab() {
  const { filters, period, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, error } = useSalesReportTab("summary", filters);

  // FY Outlook follows the fiscal year of the selected period.
  const fyStartYear = fiscalYearStartYear(period.startDate);
  const { kpis: projectionKpis } = useSalesProjections(fyStartYear);
  const outlookTile = getSalesProjectionsConfig(projectionKpis, null)[0];

  const against = comparedWith(meta, period);
  // Each headline tile opens its stage's tab, keeping the period and
  // salesperson; the stage tabs link on to the list pages.
  const tabFilter = filtersForLink(filters);
  const repFilter = repLinkFilter(meta);
  const ownerFilter = filters.owner ? { owner: filters.owner } : {};

  const budgetStatus = getStatusVariant(kpis.budgetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: { warningAt: 70, goodAt: 95 },
  });
  const targetStatus = getStatusVariant(kpis.targetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: { warningAt: 60, goodAt: 90 },
  });

  const tiles = [
    {
      icon: ReceiptIcon,
      label: "Invoiced Revenue",
      sublabel: `${period.title} · vs budget`,
      value: preciseCurrency(kpis.invoiced),
      delta: pctText(kpis.budgetAttainmentPct),
      subvalue: deltaText(calcDelta(kpis.invoiced, kpis.prevInvoiced), against),
      variant: budgetStatus.variant,
      status: budgetStatus.statusIcon
        ? { icon: budgetStatus.statusIcon, label: budgetStatus.statusLabel }
        : undefined,
      to: "../invoicing",
      filter: tabFilter,
      metrics: [
        {
          label: "Revenue Budget",
          value: kpis.budget == null ? "none set" : preciseCurrency(kpis.budget),
          to: "/app/sales/orders/budgets",
          filter: { ...repFilter },
        },
        { label: "Invoice Count", value: kpis.invoiceCount ?? 0 },
      ],
      title:
        "Invoiced revenue (A/R invoices, not cancelled, including tax) for the period, " +
        "against the revenue budget for the same days. The percentage is attainment. " +
        "Colour: Critical below 70% of budget, Watch 70–94%, On track at 95%+.",
    },
    {
      icon: FileTextIcon,
      label: "Orders Booked",
      sublabel: period.title,
      value: preciseCurrency(kpis.booked),
      subvalue: deltaText(calcDelta(kpis.booked, kpis.prevBooked), against),
      variant: "blueCard",
      to: "../orders",
      filter: tabFilter,
      metrics: [{ label: "Order Count", value: kpis.orderCount ?? 0 }],
      title:
        "Sales orders booked in the period (not cancelled). What is still open on them " +
        "lives on the Sales Orders page.",
    },
    {
      icon: WalletIcon,
      label: "Payments Collected",
      sublabel: period.title,
      value: preciseCurrency(kpis.collected),
      subvalue: deltaText(calcDelta(kpis.collected, kpis.prevCollected), against),
      variant: "blueCard",
      to: "../collections",
      filter: tabFilter,
      metrics: [{ label: "Payments", value: kpis.paymentCount ?? 0 }],
      title:
        "Cash received in the period and applied to a customer invoice. Deposits and " +
        "other cash not applied to an invoice are excluded. Payments counts receipts.",
    },
    {
      icon: GaugeIcon,
      label: "Won (CRM)",
      sublabel: `${period.title} · vs target`,
      value: preciseCurrency(kpis.won),
      delta: pctText(kpis.targetAttainmentPct),
      subvalue: deltaText(calcDelta(kpis.won, kpis.prevWon), against),
      variant: targetStatus.variant,
      status: targetStatus.statusIcon
        ? { icon: targetStatus.statusIcon, label: targetStatus.statusLabel }
        : undefined,
      to: "../pipeline",
      filter: tabFilter,
      metrics: [
        {
          label: "Pipeline Target",
          value: kpis.target == null ? "none set" : preciseCurrency(kpis.target),
          to: "/app/sales/leads/targets",
          filter: { ...ownerFilter },
        },
      ],
      title:
        "Revenue on deals marked WON in the CRM in the period (cancelled deals " +
        "excluded; close date in Malaysia time), against the pipeline target. " +
        "Win rate, losses and the open pipeline are on the Pipeline tab. " +
        "Colour: Critical below 60% of target, Watch 60–89%, On track at 90%+.",
    },
  ];

  const revenueVsBudget = shapeTrendRows(
    data?.revenueVsBudget ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ Invoiced: d.invoiced, Budget: d.budget }),
  );

  const yoy = shapeTrendRows(
    data?.orderToCashYoY ?? [],
    (d) => d.name,
    (d) => ({
      won: d.won,
      booked: d.booked,
      invoiced: d.invoiced,
      collected: d.collected,
    }),
  );

  const bridge = buildBudgetBridge(data?.budgetBridge ?? []);

  return (
    <TabState isLoading={isLoading} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={ChartLineUpIcon}
        title="Headline"
        description={`${period.title} — each figure follows the period and the salesperson.`}
      >
        <OverviewCards items={tiles} />
      </ReportSection>

      {outlookTile && (
        <ReportSection
          icon={GlobeHemisphereEastIcon}
          title="Outlook"
          description="Company-wide: the forecast for the fiscal year of the selected period. It doesn't follow the salesperson filter."
        >
          <OverviewCards
            items={[
              {
                ...outlookTile,
                to: "../forecast",
                filter: tabFilter,
              },
            ]}
          />
        </ReportSection>
      )}

      <ReportSection
        icon={ReceiptIcon}
        title="Are we on budget?"
        description="Invoiced revenue against budget, and where the gap came from."
      >
        <CardLayout style="cardLayout2">
          <ChartCard
            title="Revenue vs Budget (RM)"
            subtitle={trendSubtitle(meta, period, revenueVsBudget)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={revenueVsBudget.data}
              highlight={revenueVsBudget.highlight}
              lines={[
                { dataKey: "Invoiced", color: BLUE_COLOR },
                { dataKey: "Budget", color: YELLOW_COLOR },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Where the Budget Gap Came From (RM)"
            subtitle={`Budget → each rep's shortfall → invoiced, ${period.title}`}
            style="cardGapSmall"
          >
            {bridge.length > 0 ? (
              <HorizontalBarChartRenderer data={bridge} colorMap={BLUE_COLOR} />
            ) : (
              <NoResult title="No budget or invoicing for this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={ChartLineUpIcon}
        title="Are we growing?"
        description="Won, booked, invoiced and collected per fiscal year."
      >
        <CardLayout>
          <ChartCard
            title="Order-to-Cash — Year over Year (RM)"
            subtitle={[
              "Last 10 fiscal years — not affected by the period",
              yoy.highlight && "selected fiscal year shaded",
              yoy.hasPartial && "* year to date",
            ]
              .filter(Boolean)
              .join(" · ")}
            style="cardGapSmall"
          >
            <VerticalMultiBarRenderer
              data={yoy.data}
              highlight={yoy.highlight}
              bars={[
                { dataKey: "won", name: "Won (CRM)", color: BLUE_COLOR },
                { dataKey: "booked", name: "Orders", color: YELLOW_COLOR },
                { dataKey: "invoiced", name: "Invoiced", color: GREEN_COLOR },
                { dataKey: "collected", name: "Collected", color: PURPLE_COLOR },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

function filtersForLink(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
}

/**
 * The budget bridge: Revenue Budget -> each rep's shortfall (worst first) ->
 * reps at or above budget -> invoiced with no budget set -> Invoiced Revenue.
 * Reps without a budget row are kept OUT of the variances: their whole
 * invoiced amount would otherwise read as overperformance -- they are a
 * missing-budget problem, shown on their own bar. Rows come from
 * sales_rep_totals, so the end bar equals the Invoiced Revenue tile.
 */
function buildBudgetBridge(rows) {
  const budgeted = rows.filter((r) => (r.budget ?? 0) > 0);
  const unbudgeted = rows.filter((r) => !((r.budget ?? 0) > 0));
  if (!budgeted.length && !unbudgeted.length) return [];

  const totalBudget = budgeted.reduce((a, r) => a + r.budget, 0);
  const variances = budgeted
    .map((r) => ({ name: r.name, value: (r.invoiced ?? 0) - r.budget }))
    .sort((a, b) => a.value - b.value);
  const behind = variances.filter((v) => v.value < 0);
  const aheadTotal = variances
    .filter((v) => v.value >= 0)
    .reduce((a, v) => a + v.value, 0);
  const unbudgetedTotal = unbudgeted.reduce((a, r) => a + (r.invoiced ?? 0), 0);
  const invoiced = rows.reduce((a, r) => a + (r.invoiced ?? 0), 0);

  return [
    { name: "Revenue Budget", value: totalBudget },
    ...behind,
    ...(aheadTotal > 0
      ? [
          {
            name: `Reps at or above budget (${variances.length - behind.length})`,
            value: aheadTotal,
          },
        ]
      : []),
    ...(unbudgetedTotal > 0
      ? [
          {
            name: `Invoiced with no budget set (${unbudgeted.length})`,
            value: unbudgetedTotal,
          },
        ]
      : []),
    { name: "Invoiced Revenue", value: invoiced },
  ];
}

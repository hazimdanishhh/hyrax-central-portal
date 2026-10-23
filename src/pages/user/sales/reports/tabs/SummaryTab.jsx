// src/pages/user/sales/reports/tabs/SummaryTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  CalendarCheckIcon,
  ChartLineUpIcon,
  FileTextIcon,
  GaugeIcon,
  ReceiptIcon,
  ScalesIcon,
  SpeedometerIcon,
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
  formatDay,
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
  lastYearMetric,
  pctText,
  repLinkFilter,
  trendSubtitle,
} from "./reportFormat";

/**
 * SUMMARY -- the meeting's opening page. Data: get_sales_summary (+
 * get_sales_projections for the projected FY tile). Plan:
 * ~/.claude/plans/indexed-riding-pearl.md (storyline order, 2026-10-23).
 *
 *   Sales KPIs               the funnel left to right -- Pipeline Won ->
 *                            Sales Orders -> Invoiced Revenue -> Payments
 *                            Collected -- each opening its own tab, each
 *                            with vs last period and Same Period Last Year
 *   Fiscal Year Progress     where the FY stands and what is still needed;
 *                            the projected FY tile sits in its own row
 *                            because it is company-wide (DASHBOARD-
 *                            CONVENTIONS: a figure that ignores a filter its
 *                            neighbours follow is not their peer)
 *   Budget Variance          the monthly trend vs budget, and the gap by rep
 *   Order-to-Cash YoY        the long view
 */
export default function SummaryTab() {
  const { filters, period, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, error } = useSalesReportTab(
    "summary",
    filters,
  );

  // The projection tiles follow the fiscal year of the selected period, and
  // are the Forecast tab's own tiles (projectionConfig.js), so the two tabs
  // can't disagree. The month tile is the selected month when the period is
  // a single month; otherwise the forecast's own default month (next month
  // in the current FY, the last month with data in a closed one) -- the same
  // month the Forecast tab opens on.
  const fyStartYear = fiscalYearStartYear(period.startDate);
  const {
    kpis: projectionKpis,
    monthlyData: projectionMonthly,
    defaultExhibitMonth,
  } = useSalesProjections(fyStartYear);
  const projectionMonthKey =
    period.mode === "month" ? period.startDate : defaultExhibitMonth;
  const projectionMonthRow =
    (projectionMonthly ?? []).find(
      (r) =>
        String(r.periodMonth).slice(0, 7) === String(projectionMonthKey).slice(0, 7),
    ) || null;
  const [projectionYearTile, projectionMonthTile] = getSalesProjectionsConfig(
    projectionKpis,
    projectionMonthRow,
  );
  // Company-wide tiles: say so on the tile itself, and open the Forecast tab.
  const asCompanyWide = (tile, maxMetrics) =>
    tile && {
      ...tile,
      sublabel: [tile.sublabel, "Company-wide"].filter(Boolean).join(" · "),
      metrics: maxMetrics ? (tile.metrics ?? []).slice(0, maxMetrics) : tile.metrics,
      to: "../forecast",
      filter: filtersForLink(filters),
    };

  const against = comparedWith(meta, period);
  // Each tile opens its stage's tab, keeping the period and salesperson; the
  // stage tabs link on to the list pages.
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

  const salesKpis = [
    {
      icon: GaugeIcon,
      label: "Pipeline Won",
      sublabel: `${period.title} · vs Pipeline Target`,
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
        lastYearMetric(meta, kpis.won, kpis.lastYearWon, preciseCurrency),
      ],
      title:
        "Revenue on leads won in the period (cancelled leads excluded; close date " +
        "in Malaysia time), against the Pipeline Target. " +
        "Colour: Critical below 60% of target, Watch 60–89%, On track at 90%+.",
    },
    {
      icon: FileTextIcon,
      label: "Sales Orders",
      sublabel: period.title,
      value: preciseCurrency(kpis.booked),
      subvalue: deltaText(calcDelta(kpis.booked, kpis.prevBooked), against),
      variant: "blueCard",
      to: "../orders",
      filter: tabFilter,
      metrics: [
        { label: "Order Count", value: kpis.orderCount ?? 0 },
        lastYearMetric(meta, kpis.booked, kpis.lastYearBooked, preciseCurrency),
      ],
      title: "Sales orders placed in the period, not cancelled.",
    },
    {
      icon: ReceiptIcon,
      label: "Invoiced Revenue",
      sublabel: `${period.title} · vs Revenue Budget`,
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
        lastYearMetric(meta, kpis.invoiced, kpis.lastYearInvoiced, preciseCurrency),
      ],
      title:
        "A/R invoices in the period, not cancelled, including tax, against the " +
        "Revenue Budget for the same days. " +
        "Colour: Critical below 70% of budget, Watch 70–94%, On track at 95%+.",
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
      metrics: [
        { label: "Payments", value: kpis.paymentCount ?? 0 },
        lastYearMetric(meta, kpis.collected, kpis.lastYearCollected, preciseCurrency),
      ],
      title:
        "Payments received in the period and applied to a customer invoice. " +
        "Deposits and unapplied payments are excluded. Payments counts receipts.",
    },
  ];

  // ── Fiscal Year Progress ────────────────────────────────────────────────
  const fy = data?.fyProgress ?? {};
  const fyLabel = fy.fyStart
    ? `FY ${fy.fyStart.slice(0, 4)}-${Number(fy.fyStart.slice(0, 4)) + 1}`
    : "";
  const fytdStatus = getStatusVariant(fy.fytdAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: { warningAt: 70, goodAt: 95 },
  });
  // On pace when the monthly average so far already covers what is needed.
  // No red tier: needing more than the average is a pace to pick up, not a
  // verdict on its own.
  const onPace =
    fy.monthlyNeeded != null && fy.monthlyAverage != null
      ? fy.monthlyNeeded <= fy.monthlyAverage
      : null;

  const fyProgressKpis = [
    {
      icon: CalendarCheckIcon,
      label: "Invoiced Revenue — FY to Date",
      sublabel: fy.asOf ? `${fyLabel} · to ${formatDay(fy.asOf)}` : fyLabel,
      value: preciseCurrency(fy.fytdInvoiced),
      delta: pctText(fy.fytdAttainmentPct),
      variant: fytdStatus.variant,
      status: fytdStatus.statusIcon
        ? { icon: fytdStatus.statusIcon, label: fytdStatus.statusLabel }
        : undefined,
      to: "../invoicing",
      filter: { ...tabFilter, startDate: fy.fyStart, endDate: fy.asOf },
      metrics: [
        {
          label: "Revenue Budget — FY to Date",
          value: fy.fytdBudget == null ? "none set" : preciseCurrency(fy.fytdBudget),
        },
        {
          label: "Revenue Budget — Full FY",
          value: fy.fyBudget == null ? "none set" : preciseCurrency(fy.fyBudget),
        },
      ],
      title:
        "Invoiced revenue from the start of the fiscal year to the end of the selected " +
        "period (or today, whichever is earlier), against the Revenue Budget for the " +
        "same days. Colour: Critical below 70%, Watch 70–94%, On track at 95%+.",
    },
    {
      icon: SpeedometerIcon,
      label: "Monthly Invoicing Needed",
      sublabel:
        fy.monthsLeft > 0
          ? `${fyLabel} · ${Math.round(fy.monthsLeft * 10) / 10} month(s) left`
          : `${fyLabel} · no months left`,
      value: fy.monthlyNeeded == null ? "—" : preciseCurrency(fy.monthlyNeeded),
      variant: onPace === null ? "blueCard" : onPace ? "greenCard" : "yellowCard",
      status:
        onPace === null
          ? undefined
          : { label: onPace ? "On pace" : "Above current pace" },
      to: null,
      metrics: [
        {
          label: "Monthly Average So Far",
          value: fy.monthlyAverage == null ? "—" : preciseCurrency(fy.monthlyAverage),
        },
        {
          label: "Budget Remaining",
          value: fy.budgetRemaining == null ? "—" : preciseCurrency(fy.budgetRemaining),
        },
      ],
      title:
        "What still has to be invoiced each month, for the rest of the fiscal year, " +
        "to reach the full-year Revenue Budget (part-months count by their days). " +
        "Green when the monthly average so far already covers it, amber when it " +
        "needs a faster pace.",
    },
    // The forecast's full-year tile, trimmed to its first four sub-metrics
    // (budget, invoiced so far, not yet closed, 80% range), and its
    // selected-month tile -- both company-wide.
    asCompanyWide(projectionYearTile, 4),
    asCompanyWide(projectionMonthTile),
  ].filter(Boolean);

  const revenueVsBudget = shapeTrendRows(
    data?.revenueVsBudget ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Invoiced Revenue": d.invoiced, "Revenue Budget": d.budget }),
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
        title="Sales KPIs"
        description={`${period.title}, pipeline to payment. Each tile opens its tab.`}
      >
        <OverviewCards items={salesKpis} />
      </ReportSection>

      <ReportSection
        icon={CalendarCheckIcon}
        title="Fiscal Year Progress"
        description={`${fyLabel} to date against the Revenue Budget, what is still needed, and the projection. Projections are company-wide, not filtered by salesperson.`}
      >
        <OverviewCards items={fyProgressKpis} />
      </ReportSection>

      <ReportSection
        icon={ScalesIcon}
        title="Budget Variance"
        description="Invoiced Revenue against Revenue Budget by month, and the gap by rep."
      >
        <CardLayout style="cardLayout2">
          <ChartCard
            title="Invoiced Revenue vs Budget (RM)"
            subtitle={trendSubtitle(meta, period, revenueVsBudget)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={revenueVsBudget.data}
              highlight={revenueVsBudget.highlight}
              lines={[
                { dataKey: "Invoiced Revenue", color: BLUE_COLOR },
                { dataKey: "Revenue Budget", color: YELLOW_COLOR },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Where the Budget Gap Came From (RM)"
            subtitle={`Revenue Budget → each rep's shortfall → Invoiced Revenue, ${period.title}`}
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
        title="Order-to-Cash — Year over Year"
        description="Pipeline Won, Sales Orders, Invoiced Revenue and Payments Collected per fiscal year."
      >
        <CardLayout>
          <ChartCard
            title="Order-to-Cash — Year over Year (RM)"
            subtitle={[
              "Last 10 fiscal years, not affected by the period",
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
                { dataKey: "won", name: "Pipeline Won", color: BLUE_COLOR },
                { dataKey: "booked", name: "Sales Orders", color: YELLOW_COLOR },
                { dataKey: "invoiced", name: "Invoiced Revenue", color: GREEN_COLOR },
                {
                  dataKey: "collected",
                  name: "Payments Collected",
                  color: PURPLE_COLOR,
                },
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

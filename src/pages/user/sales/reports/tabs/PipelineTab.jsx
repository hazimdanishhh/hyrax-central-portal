// src/pages/user/sales/reports/tabs/PipelineTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ChartLineUpIcon,
  ClockCountdownIcon,
  FunnelIcon,
  GaugeIcon,
  HandshakeIcon,
  HourglassMediumIcon,
  PercentIcon,
  PlusCircleIcon,
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
  TARGET_THRESHOLDS,
  calcDelta,
  comparedWith,
  deltaText,
  lastYearMetric,
  pctText,
  periodLinkFilter,
  pointsDeltaText,
  actionTileStatus,
  todayTile,
  trendSubtitle,
} from "../../../../../functions/reportFormat";

const LEADS_LIST = "/app/sales/leads/list";

// "SAMPLE_TEST" -> "Sample Test"
const stageLabel = (stage) =>
  String(stage)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * PIPELINE -- the CRM side of the funnel. Data: get_sales_pipeline
 * (sales_lead_facts). Rules: DASHBOARD-CONVENTIONS §8.
 *
 *   Pipeline KPIs        Pipeline Generated, Pipeline Won, Win Rate (period)
 *                        | Active Pipeline (TODAY)
 *   Pipeline Trend       Pipeline Won vs Pipeline Target, monthly
 *   Active Pipeline      TODAY: Pending SAP Order Entry (the hand-off to
 *                        Orders) and the open pipeline by stage
 *   Pipeline Breakdown   what was won and lost in the period, and why
 *
 * Won = leads WON and not cancelled, closed in the period (Malaysia time).
 * Lost = leads LOST, or cancelled at any stage. Win rate = won / (won +
 * lost) by count. Generated = leads CREATED in the period, at expected
 * value (Leads Overview's own rule). Active Pipeline, Pipeline Coverage and
 * Pending SAP Order Entry are open balances: always today, no comparison
 * (R3). Daily pipeline work -- aging, on hold, the leads to chase -- stays
 * on Leads Overview.
 */
export default function PipelineTab() {
  const { filters, period, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, isUpdating, error } = useSalesReportTab("pipeline", filters);

  const against = comparedWith(meta, period);
  const p = periodLinkFilter(meta);
  const closedFilter = p.startDate
    ? { closedDateFrom: p.startDate, closedDateTo: p.endDate }
    : {};
  const ownerFilter = filters.owner ? { owner: filters.owner } : {};

  const targetStatus = getStatusVariant(kpis.targetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: TARGET_THRESHOLDS,
  });

  const coverageText =
    kpis.pipelineCoverage == null ? "—" : `${kpis.pipelineCoverage}×`;

  const pipelineKpis = [
    {
      icon: PlusCircleIcon,
      label: "Pipeline Generated",
      sublabel: period.title,
      value: preciseCurrency(kpis.generated),
      subvalue: deltaText(calcDelta(kpis.generated, kpis.prevGenerated), against),
      variant: "blueCard",
      to: LEADS_LIST,
      filter: { ...ownerFilter, ...p },
      metrics: [
        { label: "Leads Created", value: kpis.generatedCount ?? 0 },
        lastYearMetric(meta, kpis.generated, kpis.lastYearGenerated, preciseCurrency),
      ],
      title:
        "Expected revenue of leads created in the period, whatever has happened to them " +
        "since -- the new business feeding the pipeline. Same rule as Leads Overview.",
    },
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
      to: LEADS_LIST,
      filter: { ...ownerFilter, outcome: "won", ...closedFilter },
      metrics: [
        {
          label: "Pipeline Target",
          value: kpis.target == null ? "none set" : preciseCurrency(kpis.target),
          to: "/app/sales/leads/targets",
          filter: { ...ownerFilter },
        },
        // Won Leads sits on Win Rate, beside the lost count it's a ratio of (R11).
        {
          label: "Avg. Deal Size",
          value: kpis.avgDeal == null ? "—" : preciseCurrency(kpis.avgDeal),
        },
        lastYearMetric(meta, kpis.won, kpis.lastYearWon, preciseCurrency),
      ],
      title:
        "Revenue on leads won in the period (cancelled leads excluded; close date in " +
        "Malaysia time), against the Pipeline Target for the same days. Same figure as " +
        "on Summary. Colour: Critical below 60% of target, Watch 60–89%, On track at 90%+.",
    },
    {
      icon: PercentIcon,
      label: "Win Rate",
      sublabel: period.title,
      value: pctText(kpis.winRatePct),
      subvalue: pointsDeltaText(kpis.winRatePct, kpis.prevWinRatePct, against),
      variant: "blueCard",
      to: LEADS_LIST,
      filter: { ...ownerFilter, outcome: "closed", ...closedFilter },
      metrics: [
        { label: "Won Leads", value: kpis.wonCount ?? 0 },
        { label: "Total Lost Deals", value: kpis.lostCount ?? 0 },
        {
          label: "Lost Revenue",
          value: preciseCurrency(kpis.lost),
          to: LEADS_LIST,
          filter: { ...ownerFilter, outcome: "lost", ...closedFilter },
          title: "Expected revenue of leads lost or cancelled in the period. Reasons are in Pipeline Breakdown.",
        },
        {
          icon: HourglassMediumIcon,
          label: "Pipeline Cycle",
          value: kpis.avgDaysToWon == null ? "—" : `${kpis.avgDaysToWon}d`,
          title: "Average days from a lead being created to it being won, for leads won in the period.",
        },
      ],
      title:
        "Won leads ÷ leads closed (won + lost + cancelled) in the period, by count. " +
        "The change is in percentage points.",
    },
    todayTile({
      icon: FunnelIcon,
      label: "Active Pipeline",
      value: preciseCurrency(kpis.openValue),
      variant: "blueCard",
      to: LEADS_LIST,
      filter: { ...ownerFilter, outcome: "open" },
      metrics: [
        { label: "Weighted", value: preciseCurrency(kpis.weightedValue) },
        { label: "Active Leads", value: kpis.openCount ?? 0 },
        {
          label: "Pipeline Coverage",
          value: coverageText,
          title:
            kpis.targetRemaining == null
              ? "No Pipeline Target left this fiscal year."
              : `Active Pipeline ÷ the Pipeline Target still to win this fiscal year ` +
                `(${preciseCurrency(kpis.targetRemaining)}). About 3× is a common B2B benchmark.`,
        },
      ],
      title:
        "Expected revenue of every open, uncancelled lead right now. Weighted multiplies " +
        "each lead by its close probability. Pipeline Coverage compares it with the " +
        "Pipeline Target left this fiscal year. Open balances: today, whatever period " +
        "is picked.",
    }),
  ];

  const activePipelineKpis = [
    todayTile({
      icon: ClockCountdownIcon,
      label: "Pending SAP Order Entry",
      value: preciseCurrency(kpis.pendingSapValue),
      ...actionTileStatus(kpis.pendingSapCount),
      to: LEADS_LIST,
      filter: { ...ownerFilter, pendingSapOrder: "true" },
      metrics: [{ label: "Won Leads", value: kpis.pendingSapCount ?? 0 }],
      title:
        "Won leads whose PO number no SAP sales order carries yet -- the hand-off to " +
        "Orders, waiting on the sales admin. Same rule as Leads Overview (cancelled " +
        "leads left out). Green when there are none, amber (Watch) when there are any.",
    }),
  ];

  const wonVsTarget = shapeTrendRows(
    data?.wonVsTarget ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Pipeline Won": d.won, "Pipeline Target": d.target }),
  );
  const byProduct = data?.wonByProductType ?? [];
  const bySource = data?.wonBySource ?? [];
  const topClients = data?.topClients ?? [];
  const lostByReason = data?.lostByReason ?? [];
  const openByStage = (data?.openByStage ?? []).map((s) => ({
    name: stageLabel(s.name),
    Expected: s.value,
    Weighted: s.weighted,
  }));

  return (
    <TabState isLoading={isLoading} isUpdating={isUpdating} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={HandshakeIcon}
        title="Pipeline KPIs"
        description={`${period.title}, new pipeline, leads won against target, and win rate; and today, the active pipeline.`}
      >
        <OverviewCards items={pipelineKpis} />
      </ReportSection>

      <ReportSection
        icon={ChartLineUpIcon}
        title="Pipeline Trend"
        description="Pipeline Won against Pipeline Target by month."
      >
        <CardLayout>
          <ChartCard
            title="Pipeline Won vs Target (RM)"
            subtitle={trendSubtitle(meta, period, wonVsTarget)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={wonVsTarget.data}
              highlight={wonVsTarget.highlight}
              lines={[
                { dataKey: "Pipeline Won", color: MEASURE_COLORS.pipelineWon },
                { dataKey: "Pipeline Target", color: MEASURE_COLORS.plan, dashed: true },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={FunnelIcon}
        title="Active Pipeline"
        description="Today: won leads waiting for an SAP order, and the open pipeline by stage."
      >
        <OverviewCards items={activePipelineKpis} />

        <CardLayout>
          <ChartCard
            title="Active Pipeline by Stage (RM)"
            subtitle="Today · expected revenue, and weighted by close probability"
            style="cardGapSmall"
            viewAllTo={LEADS_LIST}
            viewAllFilter={{ ...ownerFilter, outcome: "open" }}
          >
            {openByStage.length ? (
              <HorizontalMultiBarRenderer
                data={openByStage}
                bars={[
                  { dataKey: "Expected", name: "Expected", color: MEASURE_COLORS.pipelineWon },
                  { dataKey: "Weighted", name: "Weighted", color: GREY_COLOR },
                ]}
              />
            ) : (
              <NoResult title="No active leads." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={GaugeIcon}
        title="Pipeline Breakdown"
        description={`${period.title}, won revenue by product type, lead source and client, and lost revenue by reason.`}
      >
        <CardLayout style="cardLayout2">
          <ChartCard title="Won by Product Type (RM)" subtitle={period.title} style="cardGapSmall">
            {byProduct.length ? (
              <HorizontalBarChartRenderer data={byProduct} colorMap={MEASURE_COLORS.pipelineWon} />
            ) : (
              <NoResult title="No leads won in this period." />
            )}
          </ChartCard>

          <ChartCard title="Won by Lead Source (RM)" subtitle={period.title} style="cardGapSmall">
            {bySource.length ? (
              <HorizontalBarChartRenderer data={bySource} colorMap={MEASURE_COLORS.pipelineWon} />
            ) : (
              <NoResult title="No leads won in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Top Clients by Won Revenue (RM)"
            subtitle={`Top 10, ${period.title}`}
            style="cardGapSmall"
          >
            {topClients.length ? (
              <HorizontalBarChartRenderer data={topClients} colorMap={MEASURE_COLORS.pipelineWon} />
            ) : (
              <NoResult title="No leads won in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Lost Revenue by Reason (RM)"
            subtitle={`Leads lost or cancelled, ${period.title}`}
            style="cardGapSmall"
            viewAllTo={LEADS_LIST}
            viewAllFilter={{ ...ownerFilter, outcome: "lost", ...closedFilter }}
          >
            {lostByReason.length ? (
              <HorizontalBarChartRenderer data={lostByReason} colorMap={MEASURE_COLORS.lost} />
            ) : (
              <NoResult title="No leads lost in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

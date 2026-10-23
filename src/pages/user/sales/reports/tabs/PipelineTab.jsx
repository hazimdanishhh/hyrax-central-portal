// src/pages/user/sales/reports/tabs/PipelineTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  ChartLineUpIcon,
  FunnelIcon,
  GaugeIcon,
  HandshakeIcon,
  HourglassMediumIcon,
  PercentIcon,
  TrendDownIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../../components/chartCard/HorizontalMultiBarRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  PURPLE_COLOR,
  RED_COLOR,
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
  lastYearMetric,
  pctText,
  periodLinkFilter,
  trendSubtitle,
} from "./reportFormat";

const LEADS_LIST = "/app/sales/leads/list";

// "SAMPLE_TEST" -> "Sample Test"
const stageLabel = (stage) =>
  String(stage)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * PIPELINE -- the CRM side of the funnel, for meetings: are we winning
 * enough against target, why do we lose, and what is coming. Data:
 * get_sales_pipeline (sales_lead_facts). Daily pipeline work -- aging, on
 * hold, pending SAP order -- stays on Leads Overview, unchanged.
 *
 * Won = deals WON and not cancelled, closed in the period (Malaysia time).
 * Lost = deals LOST, or cancelled at any stage. Win rate = won / (won +
 * lost) by count. Open Pipeline and Open by Stage are snapshots of TODAY --
 * they don't depend on the period, and say so.
 */
export default function PipelineTab() {
  const { filters, period, MappingMissingNote } = useOutletContext();
  const { data, meta, kpis, isLoading, error } = useSalesReportTab(
    "pipeline",
    filters,
  );

  const against = comparedWith(meta, period);
  const p = periodLinkFilter(meta);
  const closedFilter = p.startDate
    ? { closedDateFrom: p.startDate, closedDateTo: p.endDate }
    : {};
  const ownerFilter = filters.owner ? { owner: filters.owner } : {};

  const targetStatus = getStatusVariant(kpis.targetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: { warningAt: 60, goodAt: 90 },
  });

  const winRateChange =
    kpis.winRatePct != null && kpis.prevWinRatePct != null
      ? Math.round((kpis.winRatePct - kpis.prevWinRatePct) * 10) / 10
      : null;

  const pipelineKpis = [
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
      filter: { ...ownerFilter, stage: "WON", ...closedFilter },
      metrics: [
        {
          label: "Pipeline Target",
          value:
            kpis.target == null ? "none set" : preciseCurrency(kpis.target),
          to: "/app/sales/leads/targets",
          filter: { ...ownerFilter },
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
      subvalue:
        winRateChange == null
          ? ""
          : `${winRateChange >= 0 ? "↑" : "↓"} ${Math.abs(winRateChange)} pts vs ${against}`,
      variant: "blueCard",
      to: LEADS_LIST,
      filter: { ...ownerFilter, closedOnly: "true", ...closedFilter },
      metrics: [
        { label: "Won Leads", value: kpis.wonCount ?? 0 },
        {
          icon: HourglassMediumIcon,
          label: "Pipeline Cycle",
          value: kpis.avgDaysToWon == null ? "—" : `${kpis.avgDaysToWon}d`,
        },
      ],
      title:
        "Won leads ÷ leads closed (won + lost + cancelled) in the period, by count. " +
        "The change is in percentage points.",
    },
    {
      icon: FunnelIcon,
      label: "Active Pipeline",
      sublabel: "Today",
      value: preciseCurrency(kpis.openValue),
      variant: "blueCard",
      to: LEADS_LIST,
      filter: { ...ownerFilter, activePipelineOnly: "true" },
      metrics: [
        { label: "Weighted", value: preciseCurrency(kpis.weightedValue) },
        { label: "Active Leads", value: kpis.openCount ?? 0 },
      ],
      title:
        "Expected revenue of every open, uncancelled lead right now. Weighted " +
        "multiplies each lead by its close probability. As of today: it doesn't " +
        "change with the period.",
    },
    {
      icon: TrendDownIcon,
      label: "Lost Revenue",
      sublabel: period.title,
      value: preciseCurrency(kpis.lost),
      subvalue: deltaText(calcDelta(kpis.lost, kpis.prevLost), against),
      variant: "blueCard",
      to: null,
      metrics: [
        { label: "Total Lost Deals", value: kpis.lostCount ?? 0 },
        lastYearMetric(meta, kpis.lost, kpis.lastYearLost, preciseCurrency),
      ],
      title:
        "Expected revenue of leads lost or cancelled in the period. Reasons are in " +
        "Pipeline Breakdown.",
    },
  ];

  const activePipelineKpis = [
    {
      icon: FunnelIcon,
      label: "Active Pipeline",
      sublabel: "Today",
      value: preciseCurrency(kpis.openValue),
      variant: "blueCard",
      to: LEADS_LIST,
      filter: { ...ownerFilter, activePipelineOnly: "true" },
      metrics: [
        { label: "Weighted", value: preciseCurrency(kpis.weightedValue) },
        { label: "Active Leads", value: kpis.openCount ?? 0 },
      ],
      title:
        "Expected revenue of every open, uncancelled lead right now. Weighted " +
        "multiplies each lead by its close probability. As of today: it doesn't " +
        "change with the period.",
    },
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
    <TabState isLoading={isLoading} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={HandshakeIcon}
        title="Pipeline KPIs"
        description={`${period.title}, leads won against target, win rate, cycle and lost revenue.`}
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
                { dataKey: "Pipeline Won", color: BLUE_COLOR },
                { dataKey: "Pipeline Target", color: YELLOW_COLOR },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={FunnelIcon}
        title="Active Pipeline"
        description="Open leads as of today, by stage."
      >
        <CardLayout>
          <ChartCard
            title="Active Pipeline by Stage (RM)"
            subtitle="Today · expected revenue, and weighted by close probability"
            style="cardGapSmall"
            viewAllTo={LEADS_LIST}
            viewAllFilter={{ ...ownerFilter, activePipelineOnly: "true" }}
          >
            {openByStage.length ? (
              <HorizontalMultiBarRenderer
                data={openByStage}
                bars={[
                  { dataKey: "Expected", name: "Expected", color: BLUE_COLOR },
                  { dataKey: "Weighted", name: "Weighted", color: GREEN_COLOR },
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
          <ChartCard
            title="Won by Product Type (RM)"
            subtitle={period.title}
            style="cardGapSmall"
          >
            {byProduct.length ? (
              <HorizontalBarChartRenderer
                data={byProduct}
                colorMap={BLUE_COLOR}
              />
            ) : (
              <NoResult title="No leads won in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Won by Lead Source (RM)"
            subtitle={period.title}
            style="cardGapSmall"
          >
            {bySource.length ? (
              <HorizontalBarChartRenderer
                data={bySource}
                colorMap={GREEN_COLOR}
              />
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
              <HorizontalBarChartRenderer
                data={topClients}
                colorMap={PURPLE_COLOR}
              />
            ) : (
              <NoResult title="No leads won in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Lost Revenue by Reason (RM)"
            subtitle={`Leads lost or cancelled, ${period.title}`}
            style="cardGapSmall"
          >
            {lostByReason.length ? (
              <HorizontalBarChartRenderer
                data={lostByReason}
                colorMap={RED_COLOR}
              />
            ) : (
              <NoResult title="No leads lost in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

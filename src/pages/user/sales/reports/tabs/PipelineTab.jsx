// src/pages/user/sales/reports/tabs/PipelineTab.jsx

import { useOutletContext } from "react-router-dom";
import {
  FunnelIcon,
  GaugeIcon,
  HandshakeIcon,
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
  const { data, meta, kpis, isLoading, error } = useSalesReportTab("pipeline", filters);

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

  const tiles = [
    {
      icon: GaugeIcon,
      label: "Won vs Target",
      sublabel: period.title,
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
          value: kpis.target == null ? "none set" : preciseCurrency(kpis.target),
          to: "/app/sales/leads/targets",
          filter: { ...ownerFilter },
        },
        { label: "Deals Won", value: kpis.wonCount ?? 0 },
        {
          label: "Avg Deal Size",
          value: kpis.avgDeal == null ? "—" : preciseCurrency(kpis.avgDeal),
        },
      ],
      title:
        "Revenue on deals WON in the period (cancelled deals excluded; close date in " +
        "Malaysia time), against the pipeline target for the same days. Same figure as " +
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
        { label: "Won", value: kpis.wonCount ?? 0 },
        { label: "Lost or Cancelled", value: kpis.lostCount ?? 0 },
      ],
      title:
        "Deals won ÷ deals closed (won + lost + cancelled) in the period, by count. " +
        "The change is in percentage points.",
    },
    {
      icon: TrendDownIcon,
      label: "Lost",
      sublabel: period.title,
      value: preciseCurrency(kpis.lost),
      subvalue: deltaText(calcDelta(kpis.lost, kpis.prevLost), against),
      variant: "blueCard",
      to: null,
      metrics: [{ label: "Deals Lost or Cancelled", value: kpis.lostCount ?? 0 }],
      title:
        "Expected value of deals lost or cancelled in the period. Reasons are in the " +
        "chart below.",
    },
    {
      icon: FunnelIcon,
      label: "Open Pipeline",
      sublabel: "Today",
      value: preciseCurrency(kpis.openValue),
      variant: "blueCard",
      to: LEADS_LIST,
      filter: { ...ownerFilter, activePipelineOnly: "true" },
      metrics: [
        { label: "Weighted by Probability", value: preciseCurrency(kpis.weightedValue) },
        { label: "Open Deals", value: kpis.openCount ?? 0 },
      ],
      title:
        "Expected value of every open, uncancelled deal right now -- what is coming. " +
        "Weighted multiplies each deal by its close probability. A snapshot of today: " +
        "it doesn't change with the period.",
    },
  ];

  const wonVsTarget = shapeTrendRows(
    data?.wonVsTarget ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ Won: d.won, Target: d.target }),
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
        title="Winning business"
        description={`${period.title} — won against target, win rate and losses. Open pipeline is as of today.`}
      >
        <OverviewCards items={tiles} />

        <CardLayout>
          <ChartCard
            title="Won vs Target (RM)"
            subtitle={trendSubtitle(meta, period, wonVsTarget)}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={wonVsTarget.data}
              highlight={wonVsTarget.highlight}
              lines={[
                { dataKey: "Won", color: BLUE_COLOR },
                { dataKey: "Target", color: YELLOW_COLOR },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={GaugeIcon}
        title="Where wins come from"
        description={`Won revenue in ${period.title}, by product type, lead source and client.`}
      >
        <CardLayout style="cardLayout2">
          <ChartCard title="Won by Product Type (RM)" subtitle={period.title} style="cardGapSmall">
            {byProduct.length ? (
              <HorizontalBarChartRenderer data={byProduct} colorMap={BLUE_COLOR} />
            ) : (
              <NoResult title="No deals won in this period." />
            )}
          </ChartCard>

          <ChartCard title="Won by Lead Source (RM)" subtitle={period.title} style="cardGapSmall">
            {bySource.length ? (
              <HorizontalBarChartRenderer data={bySource} colorMap={GREEN_COLOR} />
            ) : (
              <NoResult title="No deals won in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Top Clients by Won Revenue (RM)"
            subtitle={`Top 10, ${period.title}`}
            style="cardGapSmall"
          >
            {topClients.length ? (
              <HorizontalBarChartRenderer data={topClients} colorMap={PURPLE_COLOR} />
            ) : (
              <NoResult title="No deals won in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Lost by Reason (RM)"
            subtitle={`Expected value of deals lost or cancelled, ${period.title}`}
            style="cardGapSmall"
          >
            {lostByReason.length ? (
              <HorizontalBarChartRenderer data={lostByReason} colorMap={RED_COLOR} />
            ) : (
              <NoResult title="No deals lost in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={FunnelIcon}
        title="What's coming"
        description="Open deals by stage, as of today."
      >
        <CardLayout>
          <ChartCard
            title="Open Pipeline by Stage (RM)"
            subtitle="Today · expected value, and weighted by close probability"
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
              <NoResult title="No open deals." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

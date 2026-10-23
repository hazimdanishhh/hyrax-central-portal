// src/pages/user/sales/leads/overview/LeadsOverview.jsx

import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChartBarHorizontalIcon,
  ChartLineUpIcon,
  FunnelIcon,
  GaugeIcon,
  HandshakeIcon,
  RankingIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../../components/chartCard/HorizontalMultiBarRenderer";
import {
  GREY_COLOR,
  MEASURE_COLORS,
} from "../../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import PeriodSelector from "../../../../../components/periodSelector/PeriodSelector";
import ReportSection from "../../../../../components/report/ReportSection";
import TabState from "../../../../../components/report/TabState";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import ScorecardList from "../../../../../components/sales/leads/leadsScoreCard/LeadsScoreCard";
// PARKED 2026-10-23 -- the old AI summary (generate-ai-summary +
// ai_dashboard_summaries) is insecure and its generation is broken; it comes
// back as the reusable, secure AI summary (DASHBOARD-ROADMAP.md §2.1).
// import AISummary from "../../../../../components/aiSummary/AISummary";
import { fetchLeads } from "../../../../../features/sales/leads/private/api/leadsService";
import { useLeadsOverview } from "../../../../../features/sales/leads/private/hooks/useLeadsOverview";
import { useSalesReportsMetadata } from "../../../../../features/sales/reports/private/hooks/useSalesReportsMetadata";
import { preciseCurrency } from "../../../../../functions/formatNumber";
import {
  describePeriod,
  formatMonthTick,
  shapeTrendRows,
} from "../../../../../functions/periodRange";
import {
  comparedWith,
  pctText,
  periodLinkFilter,
  trendSubtitle,
} from "../../../../../functions/reportFormat";
import { getFilterConfig } from "../../reports/config/filterConfig";
import { leadsExportColumns } from "../list/constants/exportConfig";
import {
  getActivePipelineKpis,
  getPipelineKpis,
} from "./config/overviewConfig";

// The page's only filters, all in the URL (DASHBOARD-CONVENTIONS §8 R13):
// the period, and the salesperson -- managers review each person's
// pipeline. Client, source and product are breakdown charts below; stage,
// on hold and cancelled are Leads list filters.
const FILTER_KEYS = ["startDate", "endDate", "owner"];
const LIST = "../list";

// "SAMPLE_TEST" -> "Sample Test"
const stageLabel = (stage) =>
  String(stage)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * LEADS OVERVIEW -- the sales team's pipeline page (Tier 2, daily/weekly).
 * Rebuilt 2026-10-23 to DASHBOARD-CONVENTIONS §8 (R1-R13), on the shared
 * Sales metric layer (get_sales_leads_dashboard), so every figure equals
 * Sales Reports' Pipeline tab for the same period and salesperson. Sales
 * Reports is the manager's meeting view; this page also carries the day's
 * work (Active Pipeline · Today) and is what staff see -- sales_leads' RLS
 * keeps a staff user to their own leads.
 *
 *   Pipeline KPIs           Generated, Won vs Target, Win Rate (period) |
 *                           Active Pipeline (TODAY)
 *   Pipeline Trend          Won vs Target; Generated, Won and Lost by month
 *   Active Pipeline · Today Pending SAP Order Entry, On Hold, Aging 30+ days;
 *                           open pipeline by stage and by close probability
 *   Pipeline Breakdown      lost by reason; Generated / Won / Lost by product
 *                           type, lead source and client (no lens toggle:
 *                           one definition per chart, ranked by Won)
 *   Salesperson Scorecard   Won vs Target, Win Rate, Generated, Lost, Active
 */
export default function LeadsOverview() {
  const contentRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, searchParams.get(key) || ""]),
  );
  function setFilters(updates) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (!FILTER_KEYS.includes(key)) return;
          if (value === undefined || value === null || value === "")
            next.delete(key);
          else next.set(key, String(value));
        });
        return next;
      },
      { replace: true },
    );
  }

  const { owners } = useSalesReportsMetadata();
  const filterConfig = getFilterConfig({ owners });
  const period = describePeriod(filters);
  const ownerName = owners.find(
    (o) => String(o.id) === String(filters.owner),
  )?.full_name;

  const { data, meta, kpis, isLoading, isUpdating, error } =
    useLeadsOverview(filters);
  const against = comparedWith(meta, period);
  const owner = filters.owner || null;
  const ownerFilter = owner ? { owner } : {};
  const p = periodLinkFilter(meta);
  const closedFilter = p.startDate
    ? { closedDateFrom: p.startDate, closedDateTo: p.endDate }
    : {};

  const pipelineKpis = getPipelineKpis({ kpis, meta, period, against, owner });
  const activeKpis = getActivePipelineKpis({ kpis, owner });

  const wonVsTarget = shapeTrendRows(
    data?.wonVsTarget ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Pipeline Won": d.won, "Pipeline Target": d.target }),
  );
  const monthlyActivity = shapeTrendRows(
    data?.monthlyActivity ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({
      "Pipeline Generated": d.generated,
      "Pipeline Won": d.won,
      "Lost Revenue": d.lost,
    }),
  );
  const openByStage = (data?.openByStage ?? []).map((s) => ({
    name: stageLabel(s.name),
    Expected: s.value,
    Weighted: s.weighted,
  }));
  const openByProbability = (data?.openByProbability ?? []).map((b) => ({
    name: b.name,
    value: b.value,
    color: b.name === "Not set" ? GREY_COLOR : undefined,
  }));
  const lostByReason = data?.lostByReason ?? [];
  const toBars = (rows) =>
    (rows ?? []).map((r) => ({
      name: r.name,
      "Pipeline Generated": r.generated,
      "Pipeline Won": r.won,
      "Lost Revenue": r.lost,
    }));
  const breakdownBars = [
    {
      dataKey: "Pipeline Generated",
      name: "Pipeline Generated",
      color: MEASURE_COLORS.pipelineGenerated,
    },
    {
      dataKey: "Pipeline Won",
      name: "Pipeline Won",
      color: MEASURE_COLORS.pipelineWon,
    },
    {
      dataKey: "Lost Revenue",
      name: "Lost Revenue",
      color: MEASURE_COLORS.lost,
    },
  ];
  const breakdowns = [
    {
      key: "product",
      title: "By Product Type (RM)",
      rows: toBars(data?.byProductType),
    },
    {
      key: "source",
      title: "By Lead Source (RM)",
      rows: toBars(data?.bySource),
    },
    {
      key: "clients",
      title: "Top Clients (RM)",
      rows: toBars(data?.topClients),
      top: true,
    },
  ];

  const scorecard = (data?.scorecard ?? []).map((r) => ({
    lead_owner_id: r.ownerId,
    rep_name: r.name,
    avatar_url: r.avatarUrl,
    actual_revenue: r.won,
    target_revenue: r.target,
    attainment_percentage: r.targetAttainmentPct,
    details: [
      { label: "Win Rate", value: pctText(r.winRatePct) },
      { label: "Pipeline Generated", value: preciseCurrency(r.generated) },
      { label: "Lost Revenue", value: preciseCurrency(r.lost) },
      { label: "Active Pipeline (today)", value: preciseCurrency(r.openValue) },
    ],
  }));

  const exportPdf = {
    targetRef: contentRef,
    fileName: "Sales_Leads_Overview",
    reportTitle: "Sales Leads Overview",
    logoUrl: "/logos/logo.png",
    subtitle: `${period.title} (${period.range})${ownerName ? ` · Salesperson: ${ownerName}` : ""}`,
  };

  return (
    <>
      <PeriodSelector filters={filters} onFilterChange={setFilters} />

      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        disableSearch
        enableExport
        exportFetchFn={fetchLeads}
        exportColumns={leadsExportColumns}
        exportFileNamePrefix="Sales_Leads_Export"
        exportPdf={exportPdf}
      />

      <div
        ref={contentRef}
        style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
      >
        {owner && (
          <ActiveFiltersBar
            filters={[["owner", owner]]}
            setFilters={setFilters}
            filterConfig={filterConfig}
            resetParams={() => setFilters({ owner: "" })}
          />
        )}

        <TabState isLoading={isLoading} isUpdating={isUpdating} error={error}>
          {/* PARKED 2026-10-23: <AISummary type="leads" filters={filters} /> */}

          <ReportSection
            icon={GaugeIcon}
            title="Pipeline KPIs"
            description={`${period.title}, new pipeline, leads won against target, and win rate; and today, the active pipeline.`}
          >
            <OverviewCards items={pipelineKpis} />
          </ReportSection>

          <ReportSection
            icon={ChartLineUpIcon}
            title="Pipeline Trend"
            description="Pipeline Won against Pipeline Target, and new, won and lost pipeline, by month."
          >
            <CardLayout style="cardLayout2">
              <ChartCard
                title="Pipeline Won vs Target (RM)"
                subtitle={trendSubtitle(meta, period, wonVsTarget)}
                style="cardGapSmall"
              >
                <LineChartRenderer
                  data={wonVsTarget.data}
                  highlight={wonVsTarget.highlight}
                  lines={[
                    {
                      dataKey: "Pipeline Won",
                      color: MEASURE_COLORS.pipelineWon,
                    },
                    {
                      dataKey: "Pipeline Target",
                      color: MEASURE_COLORS.plan,
                      dashed: true,
                    },
                  ]}
                />
              </ChartCard>

              <ChartCard
                title="Generated, Won and Lost by Month (RM)"
                subtitle={trendSubtitle(meta, period, monthlyActivity)}
                style="cardGapSmall"
              >
                <LineChartRenderer
                  data={monthlyActivity.data}
                  highlight={monthlyActivity.highlight}
                  lines={[
                    {
                      dataKey: "Pipeline Generated",
                      color: MEASURE_COLORS.pipelineGenerated,
                    },
                    {
                      dataKey: "Pipeline Won",
                      color: MEASURE_COLORS.pipelineWon,
                    },
                    { dataKey: "Lost Revenue", color: MEASURE_COLORS.lost },
                  ]}
                />
              </ChartCard>
            </CardLayout>
          </ReportSection>

          <ReportSection
            icon={FunnelIcon}
            title="Active Pipeline"
            description="Today, whatever period is picked: won leads waiting for an SAP order, leads on hold, aging leads, and the open pipeline by stage and close probability."
          >
            <OverviewCards items={activeKpis} />

            <CardLayout style="cardLayout2">
              <ChartCard
                title="Active Pipeline by Stage (RM)"
                subtitle="Today · expected revenue, and weighted by close probability"
                style="cardGapSmall"
                viewAllTo={LIST}
                viewAllFilter={{ ...ownerFilter, activePipelineOnly: "true" }}
              >
                {openByStage.length ? (
                  <HorizontalMultiBarRenderer
                    data={openByStage}
                    bars={[
                      {
                        dataKey: "Expected",
                        name: "Expected",
                        color: MEASURE_COLORS.pipelineWon,
                      },
                      {
                        dataKey: "Weighted",
                        name: "Weighted",
                        color: GREY_COLOR,
                      },
                    ]}
                  />
                ) : (
                  <NoResult title="No active leads." />
                )}
              </ChartCard>

              <ChartCard
                title="Active Pipeline by Close Probability (RM)"
                subtitle="Today · expected revenue in each probability band"
                style="cardGapSmall"
                viewAllTo={LIST}
                viewAllFilter={{ ...ownerFilter, activePipelineOnly: "true" }}
              >
                {openByProbability.length ? (
                  <HorizontalBarChartRenderer
                    data={openByProbability}
                    colorMap={MEASURE_COLORS.pipelineWon}
                  />
                ) : (
                  <NoResult title="No active leads." />
                )}
              </ChartCard>
            </CardLayout>
          </ReportSection>

          <ReportSection
            icon={ChartBarHorizontalIcon}
            title="Pipeline Breakdown"
            description={`${period.title}: why leads were lost, and new, won and lost pipeline by product type, lead source and client, ranked by Pipeline Won.`}
          >
            <CardLayout style="cardLayout2">
              <ChartCard
                title="Lost Revenue by Reason (RM)"
                subtitle={`Leads lost or cancelled, ${period.title}`}
                style="cardGapSmall"
                viewAllTo={LIST}
                viewAllFilter={{
                  ...ownerFilter,
                  lostOrCancelled: "true",
                  ...closedFilter,
                }}
              >
                {lostByReason.length ? (
                  <HorizontalBarChartRenderer
                    data={lostByReason}
                    colorMap={MEASURE_COLORS.lost}
                  />
                ) : (
                  <NoResult title="No leads lost in this period." />
                )}
              </ChartCard>

              {breakdowns.map((b) => (
                <ChartCard
                  key={b.key}
                  title={b.title}
                  subtitle={`${b.top ? "Top 10, " : ""}${period.title} · generated, won and lost`}
                  style="cardGapSmall"
                >
                  {b.rows.length ? (
                    <HorizontalMultiBarRenderer
                      data={b.rows}
                      bars={breakdownBars}
                    />
                  ) : (
                    <NoResult title="No leads created, won or lost in this period." />
                  )}
                </ChartCard>
              ))}
            </CardLayout>
          </ReportSection>

          <ReportSection
            icon={RankingIcon}
            title="Salesperson Scorecard"
            description={`${period.title}: each salesperson's Pipeline Won against target, win rate, new and lost pipeline, and their active pipeline today.`}
          >
            {scorecard.length ? (
              <ScorecardList
                data={scorecard}
                actualLabel="Pipeline Won"
                targetLabel="Pipeline Target"
              />
            ) : (
              <NoResult title="No pipeline activity or target for this period." />
            )}
          </ReportSection>
        </TabState>
      </div>
    </>
  );
}

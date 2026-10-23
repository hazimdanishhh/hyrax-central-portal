// src/pages/user/sales/reports/tabs/TeamTab.jsx

import { useOutletContext } from "react-router-dom";
import { ChartBarHorizontalIcon, UsersThreeIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import ScorecardList from "../../../../../components/sales/leads/leadsScoreCard/LeadsScoreCard";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../../components/chartCard/HorizontalMultiBarRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
} from "../../../../../components/chartCard/chartColors";
import { useSalesReportTab } from "../../../../../features/sales/reports/private/hooks/useSalesReportTab";
import ReportSection from "./ReportSection";
import TabState from "./TabState";

/**
 * TEAM -- per rep, for one-to-ones. Data: get_sales_team.
 *
 * The scorecard rows come from the same function as Summary's budget bridge
 * (sales_rep_totals), so the two can't disagree, and they add up to the
 * Summary totals (documents with no rep are one "Unassigned" row).
 *
 * Check-in badges replace the old page's separate "Needs Attention" list
 * (which was built but never shown). Same thresholds as before -- documented
 * estimates, not audited targets (DASHBOARD-CONVENTIONS KPI colour rules):
 *   below budget       budget set and attainment under 80%
 *   unbilled backlog   more than 30% of what was booked not yet invoiced
 *   slow collection    collected under 70% of what was invoiced
 */
export default function TeamTab() {
  const { filters, period, MappingMissingNote } = useOutletContext();
  const { data, meta, isLoading, error } = useSalesReportTab("team", filters);

  const scorecard = (data?.scorecard ?? []).map((r) => {
    const booked = r.booked ?? 0;
    const invoiced = r.invoiced ?? 0;
    const collected = r.collected ?? 0;
    const flags = [];
    if (r.attainmentPct != null && r.attainmentPct < 80) flags.push("Below budget");
    if (booked > 0 && (booked - invoiced) / booked > 0.3) flags.push("Unbilled backlog");
    if (r.collectionRatePct != null && r.collectionRatePct < 70) flags.push("Slow collection");

    return {
      lead_owner_id: r.employeeId ?? r.salesRepCode,
      rep_name: r.name,
      avatar_url: r.avatarUrl,
      actual_revenue: invoiced,
      target_revenue: r.budget,
      attainment_percentage: r.attainmentPct,
      order_value_myr: booked,
      po_vs_budget_variance_myr: r.budget == null ? null : booked - r.budget,
      po_vs_invoice_variance_myr: booked - invoiced,
      collected_myr: collected,
      invoice_vs_collected_variance_myr: invoiced - collected,
      collection_rate_pct: r.collectionRatePct,
      flags,
    };
  });

  const needsCheckIn = scorecard.filter((r) => r.flags.length > 0).length;

  const grossProfit = (data?.grossProfitByRep ?? []).map((r) => ({
    name: r.name,
    Invoiced: r.invoiced,
    "Gross Profit": r.grossProfit,
  }));
  const collectionRates = (data?.scorecard ?? [])
    .filter((r) => r.collectionRatePct != null)
    .map((r) => ({ name: r.name, value: r.collectionRatePct }));

  return (
    <TabState isLoading={isLoading} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={UsersThreeIcon}
        title="Rep Funnel Scorecard"
        description={`${period.title} — each rep's orders, invoicing and collection against budget.${
          needsCheckIn ? ` ${needsCheckIn} rep(s) flagged for a check-in.` : ""
        }`}
      >
        {scorecard.length > 0 ? (
          <ScorecardList data={scorecard} actualLabel="Invoiced" targetLabel="Budget" />
        ) : (
          <NoResult title="No orders, invoices, collections or budget for this period." />
        )}
      </ReportSection>

      <ReportSection
        icon={ChartBarHorizontalIcon}
        title="Rep Breakdown"
        description={`${period.title}, Invoiced Revenue and gross profit, and collection rate, by rep.`}
      >
        <CardLayout style="cardLayout2">
          <ChartCard
            title="Revenue & Gross Profit by Rep (RM)"
            subtitle={period.title}
            style="cardGapSmall"
          >
            {grossProfit.length ? (
              <HorizontalMultiBarRenderer
                data={grossProfit}
                bars={[
                  { dataKey: "Invoiced", name: "Invoiced", color: BLUE_COLOR },
                  { dataKey: "Gross Profit", name: "Gross Profit", color: GREEN_COLOR },
                ]}
              />
            ) : (
              <NoResult title="No invoices in this period." />
            )}
          </ChartCard>

          <ChartCard
            title="Collection Rate by Rep (%)"
            subtitle={`${period.title} · collected ÷ invoiced in the same period`}
            style="cardGapSmall"
          >
            {collectionRates.length ? (
              <HorizontalBarChartRenderer data={collectionRates} colorMap={GREEN_COLOR} />
            ) : (
              <NoResult title="No invoices in this period." />
            )}
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}

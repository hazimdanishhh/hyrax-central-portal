// src/pages/user/sales/reports/tabs/TeamTab.jsx

import { useOutletContext } from "react-router-dom";
import { ChartBarHorizontalIcon, UsersThreeIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import HorizontalMultiBarRenderer from "../../../../../components/chartCard/HorizontalMultiBarRenderer";
import { MEASURE_COLORS } from "../../../../../components/chartCard/chartColors";
import { useSalesReportTab } from "../../../../../features/sales/reports/private/hooks/useSalesReportTab";
import ReportSection from "./ReportSection";
import RepFunnelScorecard from "./RepFunnelScorecard";
import TabState from "./TabState";
import {
  BUDGET_THRESHOLDS,
  GROSS_MARGIN_RELEASED,
  TARGET_THRESHOLDS,
} from "./reportFormat";

/**
 * TEAM -- per salesperson, for one-to-ones. Data: get_sales_team. Rules:
 * DASHBOARD-CONVENTIONS §8.
 *
 *   Rep Funnel Scorecard   the funnel per salesperson -- Pipeline Won vs
 *                          Target and Win Rate (CRM), Sales Orders, Invoiced
 *                          Revenue vs Budget, Payments Collected (SAP) --
 *                          plus their open balances today. The rows add up
 *                          to every tab's totals (one row for documents with
 *                          no rep, one for leads with no owner).
 *   Rep Breakdown          Invoiced Revenue & Gross Profit by Rep (released
 *                          with Gross Margin), and Overdue by Rep (today)
 *
 * Check-in flags fire exactly when the same figure on a tile would read
 * Critical (shared thresholds in reportFormat.js), or when the rep has
 * something waiting today:
 *   Below Pipeline Target   Pipeline Won under 60% of target
 *   Below Budget            Invoiced Revenue under 70% of budget
 *   Delivered, Not Invoiced orders delivered with no invoice yet (today)
 *   Critically Overdue      invoices 90+ days past due (today)
 */
export default function TeamTab() {
  const { filters, period, MappingMissingNote } = useOutletContext();
  const { data, meta, isLoading, error } = useSalesReportTab("team", filters);

  const rows = (data?.scorecard ?? []).map((r) => {
    const flags = [];
    if (r.targetAttainmentPct != null && r.targetAttainmentPct < TARGET_THRESHOLDS.warningAt)
      flags.push("Below Pipeline Target");
    if (r.attainmentPct != null && r.attainmentPct < BUDGET_THRESHOLDS.warningAt)
      flags.push("Below Budget");
    if ((r.unbilledValue ?? 0) > 0) flags.push("Delivered, Not Invoiced");
    if ((r.criticalValue ?? 0) > 0) flags.push("Critically Overdue");
    return { ...r, flags };
  });
  const needsCheckIn = rows.filter((r) => r.flags.length > 0).length;

  const grossProfit = (data?.grossProfitByRep ?? []).map((r) => ({
    name: r.name,
    "Invoiced Revenue": r.invoiced,
    "Gross Profit": r.grossProfit,
  }));
  const overdueByRep = (data?.overdueByRep ?? []).map((r) => ({
    name: r.name,
    Overdue: r.overdue,
    "Critically Overdue": r.critical,
  }));

  return (
    <TabState isLoading={isLoading} error={error}>
      <MappingMissingNote meta={meta} />

      <ReportSection
        icon={UsersThreeIcon}
        title="Rep Funnel Scorecard"
        description={`${period.title}: each salesperson's pipeline, orders, invoicing and payments against target and budget, and what is open today.${
          needsCheckIn ? ` ${needsCheckIn} flagged for a check-in.` : ""
        }`}
      >
        {rows.length > 0 ? (
          <RepFunnelScorecard rows={rows} />
        ) : (
          <NoResult title="No leads, orders, invoices, payments, target or budget for this period." />
        )}
      </ReportSection>

      <ReportSection
        icon={ChartBarHorizontalIcon}
        title="Rep Breakdown"
        description={
          GROSS_MARGIN_RELEASED
            ? `${period.title}, Invoiced Revenue and Gross Profit by rep; Overdue by rep as of today.`
            : "Overdue invoices by rep, as of today."
        }
      >
        <CardLayout style={GROSS_MARGIN_RELEASED ? "cardLayout2" : "cardLayout1"}>
          {GROSS_MARGIN_RELEASED && (
            <ChartCard
              title="Invoiced Revenue & Gross Profit by Rep (RM)"
              subtitle={`${period.title} · gross profit where SAP's figure is known`}
              style="cardGapSmall"
            >
              {grossProfit.length ? (
                <HorizontalMultiBarRenderer
                  data={grossProfit}
                  bars={[
                    { dataKey: "Invoiced Revenue", name: "Invoiced Revenue", color: MEASURE_COLORS.invoicedRevenue },
                    { dataKey: "Gross Profit", name: "Gross Profit", color: MEASURE_COLORS.grossProfit },
                  ]}
                />
              ) : (
                <NoResult title="No invoices in this period." />
              )}
            </ChartCard>
          )}

          <ChartCard
            title="Overdue by Rep (RM)"
            subtitle="Today · past due, and critically overdue (90+ days)"
            style="cardGapSmall"
          >
            {overdueByRep.length ? (
              <HorizontalMultiBarRenderer
                data={overdueByRep}
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
    </TabState>
  );
}

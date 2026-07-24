import {
  GaugeIcon,
  ReceiptIcon,
  FileTextIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../../functions/formatNumber";

/**
 * Two forecasts, surfaced side by side and never blended into one number --
 * see docs/DASHBOARD-IA-STRATEGY.md §7 and
 * docs/DEPARTMENT-DASHBOARD-BLUEPRINT.md §4.2.
 *
 * `scorecard` is the RPC's invoiceBudgetScorecardData array -- the
 * department-level Forecast 2 KPI is a rollup of it, computed here rather
 * than in SQL, mirroring how Finance computes its period-over-period deltas
 * in this same config layer rather than in the RPC.
 */
export function getSalesReportsOverviewConfig(kpis, scorecard = []) {
  const totalInvoiced = scorecard.reduce(
    (sum, r) => sum + (r.invoiced_revenue || 0),
    0,
  );
  const totalBudget = scorecard.reduce(
    (sum, r) => sum + (r.budget_revenue || 0),
    0,
  );
  const budgetAttainmentPct =
    totalBudget > 0 ? Math.round((totalInvoiced / totalBudget) * 100) : 0;

  return [
    // ==========================================
    // PILLAR 1: Pipeline Attainment (Forecast 1 -- CRM, self-reported)
    // ==========================================
    {
      icon: GaugeIcon,
      label: "Pipeline Attainment",
      sublabel: "CRM, self-reported at deal-close, vs quota",
      value: `${kpis.pipelineAttainmentPct || 0}%`,
      variant: "blueCardFill",
      to: null,
      metrics: [
        {
          label: "Target",
          value: compactCurrency(kpis.pipelineTargetRevenue),
        },
        {
          label: "Won (CRM)",
          value: compactCurrency(kpis.pipelineWonRevenue),
        },
      ],
      title:
        "Forward-looking pipeline/coaching signal -- reps' own declared revenue at deal-close, vs their monthly quota. Not cross-checked against SAP; may legitimately disagree with Invoice Budget Attainment.",
    },

    // ==========================================
    // PILLAR 2: Invoice Budget Attainment (Forecast 2 -- SAP, system-of-record)
    // ==========================================
    {
      icon: ReceiptIcon,
      label: "Invoice Budget Attainment",
      sublabel: "SAP system-of-record revenue vs budget",
      value: `${budgetAttainmentPct}%`,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "Invoiced (SAP)",
          value: compactCurrency(totalInvoiced),
        },
        {
          label: "Budget",
          value: compactCurrency(totalBudget),
        },
      ],
      title:
        "Backward-looking, audited signal -- SAP-recognized invoice revenue vs the sales_budgets target. May legitimately disagree with Pipeline Attainment; see the Department Dashboard Blueprint §4.2.",
    },

    // ==========================================
    // PILLAR 3: Order Book (the leading indicator between the two forecasts)
    // ==========================================
    {
      icon: FileTextIcon,
      label: "Order Book",
      sublabel: "SAP Sales Orders Booked (This Period)",
      value: compactCurrency(kpis.orderBookValue),
      variant: "yellowCard",
      // Links to the new Sales Orders list, unfiltered -- not passing the
      // period's startDate/endDate through, consistent with how Finance's
      // "Revenue Invoiced" tile links to Invoices without its own period
      // filter.
      to: "../orders",
      metrics: [
        {
          label: "Win Rate",
          value: `${kpis.winRatePct || 0}%`,
        },
        {
          label: "Avg Deal Size",
          value: compactCurrency(kpis.avgDealSize),
        },
      ],
      title:
        "Value of SAP sales orders booked this period -- a leading indicator sitting between pipeline commitment and invoiced revenue.",
    },

    // ==========================================
    // PILLAR 4: Sales Cycle Health
    // ==========================================
    {
      icon: TrophyIcon,
      label: "Sales Cycle",
      sublabel: "Avg Days to Close (This Period)",
      value: `${kpis.avgDaysToClose || 0}d`,
      variant: "redCard",
      to: null,
      metrics: [
        {
          label: "Quote → Win",
          value: `${kpis.quoteToWinConversionPct || 0}%`,
        },
        {
          label: "Median Days to Win",
          value: `${kpis.medianDaysToWin || 0}d`,
        },
      ],
      title:
        "Average days from lead creation to a WON deal this period, and how often a sent quotation converts to a win.",
    },
  ];
}

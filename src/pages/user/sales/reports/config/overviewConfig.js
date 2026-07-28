import {
  GaugeIcon,
  ReceiptIcon,
  FileTextIcon,
  TrophyIcon,
  StackIcon,
  LightningIcon,
  UsersThreeIcon,
  PercentIcon,
  TimerIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../../functions/formatNumber";

/**
 * Sales Reports redesign (added 2026-07), rebalanced (added 2026-07): the
 * company's real day-to-day focus is invoices, budget, and collected cash --
 * the CRM pipeline is a newer, secondary functional addition that stays, but
 * shouldn't dominate. Auditing the true source of every tile (not just its
 * block label) found the page was more CRM-skewed than it looked: "Sales
 * Cycle" and the old "Client Concentration" were both CRM-sourced despite
 * sitting in the "Execution" block. This pass fixes the true ratio to 4 SAP
 * tiles : 4 CRM tiles, in two blocks: **Invoices, Budget & Collections**
 * (SAP-side, now first/primary -- tiles 1-4), then **Pipeline & Conversion**
 * (CRM-side, now second/secondary -- tiles 5-8). OverviewCards hardcodes a
 * 4-column grid, so Pipeline Coverage + Pipeline Velocity (both newer,
 * synthesized signals) are merged into one "Pipeline Health" tile, freeing a
 * slot for the new Cash Collected tile without growing past 8.
 *
 * The two forecasts (Pipeline Attainment / Invoice Budget Attainment) are
 * still surfaced side by side and never blended into one number -- see
 * docs/DASHBOARD-ROADMAP.md §1.2 and §5 (Duality A/B). `scorecard` is the
 * RPC's invoiceBudgetScorecardData array (still used here for the
 * department-level Revenue Budget rollup, since there's no dept-wide budget
 * total in `kpis` -- budget_math is per-rep only). `topInvoicedCustomers` is
 * the RPC's topInvoicedCustomersData array (LIMIT 10, sorted by revenue_myr
 * desc), feeding the Customer Concentration tile.
 *
 * Source-labeling convention (added 2026-07, see DASHBOARD-CONVENTIONS.md):
 * labels/sublabels name the literal source table instead of a generic word
 * -- "Pipeline Target" (sales_targets, a manually-set quota) vs "Revenue
 * Budget" (sales_budgets, a manually-set per-rep budget) vs "Sales Order"
 * (sap_sales_orders) vs "Invoice" (sap_invoices) -- so no two
 * differently-sourced figures can read as the same thing. "Customer"
 * (this page's Customer Concentration tile, sourced from SAP's own
 * customer_code on sap_invoices, converted from CRM 2026-07) is kept
 * distinct from "Client" (this page's own "Top Clients" chart, sourced from
 * the CRM-native `clients` table, unchanged) -- this page now legitimately
 * uses both words, one per source table. See DASHBOARD-CONVENTIONS.md.
 */
export function getSalesReportsOverviewConfig(
  kpis,
  scorecard = [],
  topInvoicedCustomers = [],
) {
  const totalBudget = scorecard.reduce(
    (sum, r) => sum + (r.budget_revenue || 0),
    0,
  );
  // Invoiced total now reads kpis.totalInvoiced (added 2026-07) instead of
  // summing the scorecard client-side -- same number in the common case,
  // slightly more correct in an edge case the scorecard's own WHERE clause
  // drops (a net-negative-invoiced rep with no orders/collections/budget).
  const budgetAttainmentPct =
    totalBudget > 0
      ? Math.round(((kpis.totalInvoiced || 0) / totalBudget) * 100)
      : 0;

  // Ratios are unitless multiples, not currency -- "2.40x" reads as coverage
  // the way "RM 2.4M" reads as an amount. null (a divide-by-zero guard)
  // renders "—", never "0.00x" -- mirrors Finance's formatRatio.
  const formatRatio = (value) =>
    value === null || value === undefined
      ? "—"
      : `${Number(value).toFixed(2)}x`;

  // PIPELINE HEALTH -- coverage ratio: open pipeline against this period's
  // quota. activePipelineValue is a point-in-time "right now" snapshot (see
  // the RPC's lead_kpis comment) while pipelineTargetRevenue is prorated to
  // the selected period -- that pairing is the point of a coverage ratio,
  // but it's why the tile's tooltip calls it out explicitly.
  const coverageRatio =
    kpis.pipelineTargetRevenue > 0
      ? kpis.activePipelineValue / kpis.pipelineTargetRevenue
      : null;

  // PIPELINE HEALTH -- velocity: RM of won revenue the pipeline throws off
  // per day. null (renders "—") when avgDaysToClose is 0/null, which is the
  // no-WON-deals-in-this-period case, not a real zero-day sales cycle.
  const pipelineVelocity =
    kpis.avgDaysToClose > 0
      ? ((kpis.totalOpportunities || 0) *
          (kpis.avgDealSize || 0) *
          ((kpis.winRatePct || 0) / 100)) /
        kpis.avgDaysToClose
      : null;

  // CUSTOMER CONCENTRATION -- converted 2026-07 from CRM (clients/WON
  // revenue) to SAP-invoiced revenue, per explicit product decision:
  // concentration risk is a revenue-dependency question that belongs on
  // audited billing data, not self-reported pipeline. topInvoicedCustomers
  // is LIMITed to 10 in SQL, so slice(0, 5) really is the top 5; the
  // re-sort is defensive only (json_agg doesn't formally guarantee it
  // preserves the subquery's own ORDER BY).
  //
  // Denominator is kpis.totalInvoiced -- the SAME base_invoices CTE, same
  // window, as topInvoicedCustomersData itself -- so this share is now
  // exact, not an approximation. (The prior CRM version was "slightly
  // conservative" because topClientsData inner-joined clients and excluded
  // cancelled leads while its denominator, pipelineWonRevenue, didn't --
  // that caveat no longer applies.)
  const top5InvoicedRevenue = [...topInvoicedCustomers]
    .sort((a, b) => (b.revenue_myr || 0) - (a.revenue_myr || 0))
    .slice(0, 5)
    .reduce((sum, r) => sum + (r.revenue_myr || 0), 0);
  const concentrationPct =
    kpis.totalInvoiced > 0
      ? Math.round((top5InvoicedRevenue / kpis.totalInvoiced) * 100)
      : null;

  // BACKLOG GAP -- booked but not yet invoiced. Uses kpis.totalInvoiced
  // (same field Invoice Budget Attainment now reads) so this figure and that
  // tile always agree on what "invoiced" means. Negative = invoiced more
  // than was booked this period, i.e. billing against orders booked earlier
  // -- same sign convention as the scorecard's own po_vs_invoice_variance_myr.
  const backlogGap = (kpis.orderBookValue || 0) - (kpis.totalInvoiced || 0);

  return [
    // ==========================================
    // INVOICES, BUDGET & COLLECTIONS (SAP, primary)
    // ==========================================

    // TILE 1: Invoice Budget Attainment (Forecast 2 -- SAP, system-of-record)
    {
      icon: ReceiptIcon,
      label: "Invoice Budget Attainment",
      sublabel: "Invoiced Revenue vs Invoice Budget (This Period)",
      value: `${budgetAttainmentPct}%`,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "Invoiced Revenue",
          value: compactCurrency(kpis.totalInvoiced),
        },
        {
          label: "Revenue Budget",
          value: compactCurrency(totalBudget),
        },
      ],
      title: "Backward-looking, Invoiced Revenue VS Invoice Budget.",
    },

    // TILE 2: Cash Collected -- new (2026-07 rebalance). Closes this page's
    // biggest content gap: it tracked Sales Order -> Invoice -> Budget but
    // never whether invoiced revenue was actually collected.
    {
      icon: WalletIcon,
      label: "Payments Collected",
      sublabel: "Total Collected (This Period)",
      value: compactCurrency(kpis.totalCollected),
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "Collection Rate",
          value: `${kpis.collectionRatePct || 0}%`,
          icon: PercentIcon,
        },
        {
          label: "Avg Invoice Value",
          value: compactCurrency(kpis.avgInvoiceValue),
        },
      ],
      title:
        "Cash actually applied against invoices via SAP payment applications this period. Collection Rate is the share of invoiced revenue that was collected this period. Avg Invoice Value is the mean of all invoices issued this period, regardless of whether they were paid.",
    },

    // TILE 3: Sales Order Book -- unchanged.
    {
      icon: FileTextIcon,
      label: "Sales Order Book",
      sublabel: "Sales Orders Booked (This Period)",
      value: compactCurrency(kpis.orderBookValue),
      variant: "yellowCard",
      // Links to the Sales Orders list, unfiltered -- not passing the
      // period's startDate/endDate through, consistent with how Finance's
      // "Revenue Invoiced" tile links to Invoices without its own period
      // filter.
      to: "../orders",
      metrics: [
        {
          label: "Sales Orders",
          value: kpis.orderBookCount || 0,
        },
        {
          label: "Backlog Gap",
          value: compactCurrency(backlogGap),
        },
      ],
      title:
        "Value of Sales Orders booked this period. Backlog Gap is Sales Order value minus Invoiced Revenue: positive means orders booked this period haven't all been billed yet; negative means invoicing outpaced new bookings, e.g. billing against orders booked earlier.",
    },

    // TILE 4: Customer Concentration -- converted 2026-07 from CRM
    // ("Client Concentration") to SAP-invoiced revenue. 100% RPC-fed, no
    // extra query beyond topInvoicedCustomersData/totalInvoiced already
    // needed elsewhere on this page.
    {
      icon: UsersThreeIcon,
      label: "Customer Concentration",
      sublabel: "Top 5 Customers' Share of Invoiced Revenue",
      value: concentrationPct === null ? "—" : `${concentrationPct}%`,
      variant:
        concentrationPct >= 60
          ? "redCard"
          : concentrationPct >= 30
            ? "yellowCard"
            : "greenCard",
      to: null,
      metrics: [
        {
          label: "Top 5 Revenue",
          value: compactCurrency(top5InvoicedRevenue),
        },
        {
          label: "Top Customer",
          value: topInvoicedCustomers[0]?.customer_name ?? "—",
        },
      ],
      title:
        "Share of this period's invoiced revenue held by the 5 largest accounts. Above 60% means the department's number depends on a handful of relationships.",
    },

    // ==========================================
    // PIPELINE & CONVERSION (CRM, secondary)
    // ==========================================

    // TILE 5: Pipeline Attainment (Forecast 1 -- CRM, self-reported)
    {
      icon: GaugeIcon,
      label: "Leads Pipeline Attainment",
      sublabel: "CRM, self-reported at deal-close, vs quota",
      value: `${kpis.pipelineAttainmentPct || 0}%`,
      variant: "blueCardFill",
      to: null,
      metrics: [
        {
          label: "Pipeline Won Revenue",
          value: compactCurrency(kpis.pipelineWonRevenue),
        },
        {
          label: "Pipeline Target",
          value: compactCurrency(kpis.pipelineTargetRevenue),
        },
      ],
      title:
        "Forward-looking pipeline/coaching signal -- reps' own declared revenue at deal-close (sales_leads), vs a manually-set monthly quota (sales_targets).",
    },

    // TILE 6: Pipeline Health -- merged 2026-07 from the previous separate
    // Pipeline Coverage + Pipeline Velocity tiles, freeing a headline slot
    // for Cash Collected above without growing past 8 tiles (OverviewCards
    // is a hardcoded 4-column grid).
    {
      icon: StackIcon,
      label: "Leads Pipeline Health",
      sublabel: "Open Pipeline (Today) vs This Period's Quota",
      value: formatRatio(coverageRatio),
      variant: "blueCardFill",
      to: null,
      metrics: [
        {
          label: "Pipeline Value",
          value: compactCurrency(kpis.activePipelineValue),
        },
        {
          label: "Velocity",
          value:
            pipelineVelocity === null
              ? "—"
              : `${compactCurrency(pipelineVelocity)}/day`,
          icon: LightningIcon,
        },
      ],
      title:
        "Coverage: Current Active Pipeline divided by Leads Target (Quota) -- Roughly 3x is a healthy coverage floor. Live snapshot, ignores the date filter. Velocity: Lead Opportunities Created X Average Deal Size X Win Rate divided by Average Days to Close -- Roughly the RM of won revenue this pipeline generates per day. Opportunity Count = leads created this period. Deal size/win rate/cycle time are measured over deals WON this period. Weighted pipeline (applying each lead's own close probability): " +
        `${compactCurrency(kpis.weightedPipelineValue)}.`,
    },

    // TILE 7: Win Rate -- unchanged.
    {
      icon: TrophyIcon,
      label: "Leads Win Rate",
      sublabel: "WON vs WON + LOST (This Period)",
      value: `${kpis.winRatePct || 0}%`,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "Avg Deal Size",
          value: compactCurrency(kpis.avgDealSize),
        },
        {
          label: "Quote → Win",
          value: `${kpis.quoteToWinConversionPct || 0}%`,
          icon: PercentIcon,
        },
      ],
      title:
        "WON deals as a share of WON + LOST closed in this period (cancelled leads excluded). Quote → Win is the narrower funnel: of leads that had a quotation sent, how many closed WON.",
    },

    // TILE 8: Sales Cycle -- unchanged value/sub, relocated here 2026-07
    // (it's CRM/sales_leads-sourced deal cycle time, so it was mis-grouped
    // in the "Execution" block before this rebalance).
    {
      icon: TimerIcon,
      label: "Sales Leads Cycle",
      sublabel: "Avg Days to Close (This Period)",
      value: `${kpis.avgDaysToClose || 0}d`,
      variant: "redCard",
      to: null,
      metrics: [
        {
          label: "Median Days to Win",
          value: `${kpis.medianDaysToWin || 0}d`,
        },
      ],
      title:
        "Average days from lead creation to a WON deal this period, and the median version of the same measure (less sensitive to a handful of unusually slow or fast deals).",
    },
  ];
}

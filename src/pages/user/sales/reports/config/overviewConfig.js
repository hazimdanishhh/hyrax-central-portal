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
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../../functions/formatNumber";

/**
 * Sales Reports redesign (added 2026-07): rebuilt from 4 headline tiles to 8,
 * following the same "~7 headline numbers" / "what -> so what -> now what"
 * methodology already applied to Finance Reports, telling doc-02's own Sales
 * Story directly ("Where are deals in the pipeline, will we hit target, and
 * are we fulfilling what we sold?") in two blocks: Pipeline & Conversion
 * (CRM-side, forward-looking -- tiles 1-4), then Execution, Bookings &
 * Concentration (SAP-side, backward-looking -- tiles 5-8). OverviewCards
 * hardcodes a 4-column grid, so the split is 4+4, not the conceptually
 * cleaner 5+3.
 *
 * The two forecasts (Pipeline Attainment / Invoice Budget Attainment) are
 * still surfaced side by side and never blended into one number -- see
 * docs/DASHBOARD-ROADMAP.md §1.2 and §5 (Duality A/B). `scorecard` is the
 * RPC's invoiceBudgetScorecardData array -- the department-level Forecast 2
 * KPI is a rollup of it, computed here rather than in SQL, mirroring how
 * Finance computes its period-over-period deltas in this same config layer
 * rather than in the RPC. `topClients` is the RPC's topClientsData array
 * (already LIMIT 10, sorted by won_revenue desc), reused here for the new
 * Client Concentration tile so it and the existing Top Clients chart never
 * read two different snapshots of the same data.
 *
 * Source-labeling convention (added 2026-07, see DASHBOARD-CONVENTIONS.md):
 * labels/sublabels name the literal source table instead of a generic word
 * -- "Pipeline Target" (sales_targets, a manually-set quota) vs "Revenue
 * Budget" (sales_budgets, a manually-set per-rep budget) vs "Sales Order"
 * (sap_sales_orders) vs "Invoice" (sap_invoices) -- so no two
 * differently-sourced figures can read as the same thing. "Client" (this
 * page, sourced from the CRM-native `clients` table) is likewise kept
 * distinct from Finance Reports' "Customer" (sourced from SAP's own
 * customer_code on sap_invoices) -- different tables, deliberately not
 * interchangeable words.
 */
export function getSalesReportsOverviewConfig(
  kpis,
  scorecard = [],
  topClients = [],
) {
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

  // Ratios are unitless multiples, not currency -- "2.40x" reads as coverage
  // the way "RM 2.4M" reads as an amount. null (a divide-by-zero guard)
  // renders "—", never "0.00x" -- mirrors Finance's formatRatio.
  const formatRatio = (value) =>
    value === null || value === undefined
      ? "—"
      : `${Number(value).toFixed(2)}x`;

  // PIPELINE COVERAGE -- open pipeline against this period's quota.
  // activePipelineValue is a point-in-time "right now" snapshot (see the
  // RPC's lead_kpis comment) while pipelineTargetRevenue is prorated to the
  // selected period -- that pairing is the point of a coverage ratio, but
  // it's why the tile's tooltip calls it out explicitly. Computed here, not
  // in SQL, mirroring budgetAttainmentPct above.
  const coverageRatio =
    kpis.pipelineTargetRevenue > 0
      ? kpis.activePipelineValue / kpis.pipelineTargetRevenue
      : null;

  // PIPELINE VELOCITY -- RM of won revenue the pipeline throws off per day.
  // null (renders "—") when avgDaysToClose is 0/null, which is the
  // no-WON-deals-in-this-period case, not a real zero-day sales cycle.
  const pipelineVelocity =
    kpis.avgDaysToClose > 0
      ? ((kpis.totalOpportunities || 0) *
          (kpis.avgDealSize || 0) *
          ((kpis.winRatePct || 0) / 100)) /
        kpis.avgDaysToClose
      : null;

  // CUSTOMER CONCENTRATION -- share of WON revenue held by the 5 biggest
  // accounts. topClientsData is LIMITed to 10 in SQL, so slice(0, 5) really
  // is the top 5; the re-sort is defensive only (json_agg doesn't formally
  // guarantee it preserves the subquery's own ORDER BY).
  //
  // Denominator is pipelineWonRevenue -- the same "Won (CRM)" figure the
  // Pipeline Attainment tile shows -- so the two tiles visibly reconcile.
  // It's a marginally wider base than topClientsData's own (that dataset
  // inner-joins clients and excludes cancelled leads), so this share is
  // slightly conservative, never overstated.
  const top5WonRevenue = [...topClients]
    .sort((a, b) => (b.won_revenue || 0) - (a.won_revenue || 0))
    .slice(0, 5)
    .reduce((sum, r) => sum + (r.won_revenue || 0), 0);
  const concentrationPct =
    kpis.pipelineWonRevenue > 0
      ? Math.round((top5WonRevenue / kpis.pipelineWonRevenue) * 100)
      : null;

  // BACKLOG GAP -- booked but not yet invoiced. Uses the scorecard's own
  // totalInvoiced (not a separate RPC total) so this figure and the Invoice
  // Budget Attainment tile always agree on what "invoiced" means. Negative =
  // invoiced more than was booked this period, i.e. billing against orders
  // booked earlier -- same sign convention as the scorecard's own
  // po_vs_invoice_variance_myr.
  const backlogGap = (kpis.orderBookValue || 0) - totalInvoiced;

  return [
    // ==========================================
    // PIPELINE & CONVERSION (CRM-side, forward-looking)
    // ==========================================

    // TILE 1: Pipeline Attainment (Forecast 1 -- CRM, self-reported)
    {
      icon: GaugeIcon,
      label: "Pipeline Attainment",
      sublabel: "CRM, self-reported at deal-close, vs quota",
      value: `${kpis.pipelineAttainmentPct || 0}%`,
      variant: "blueCardFill",
      to: null,
      metrics: [
        {
          label: "Pipeline Target",
          value: compactCurrency(kpis.pipelineTargetRevenue),
        },
        {
          label: "Pipeline Won",
          value: compactCurrency(kpis.pipelineWonRevenue),
        },
      ],
      title:
        "Forward-looking pipeline/coaching signal -- reps' own declared revenue at deal-close (sales_leads), vs a manually-set monthly quota (sales_targets, not an SAP figure). Not cross-checked against SAP; may legitimately disagree with Invoice Budget Attainment.",
    },

    // TILE 2: Pipeline Coverage (Is there enough still in flight?) -- new,
    // fills doc-02's "Pipeline value & coverage ratio" bullet, which wasn't
    // represented anywhere on this page before -- Pipeline Attainment above
    // is WON-vs-target only (closed/backward-looking).
    {
      icon: StackIcon,
      label: "Pipeline Coverage",
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
          label: "Weighted Pipeline",
          value: compactCurrency(kpis.weightedPipelineValue),
          icon: PercentIcon,
        },
      ],
      title:
        "Open pipeline (sales_leads, not WON/LOST, not cancelled), as of today, divided by this period's prorated quota (sales_targets, a manually-set figure, not SAP) -- roughly 3x is a healthy coverage floor. The numerator is a live snapshot and deliberately ignores the date filter; the denominator is prorated to it. Filtering by product type narrows the pipeline but not the quota, so coverage reads low under that filter. Weighted pipeline applies each lead's own close probability.",
    },

    // TILE 3: Win Rate -- promoted from a buried Order Book sub-metric to
    // its own tile (doc-02 explicitly calls for "KPI cards for win
    // rate/velocity").
    {
      icon: TrophyIcon,
      label: "Win Rate",
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

    // TILE 4: Pipeline Velocity -- new, synthesized from fields already on
    // this page. Same "state the synthesis honestly" precedent as Finance's
    // Cash Cycle tile: this mixes windows (see tooltip) rather than
    // pretending to be a single clean measurement.
    {
      icon: LightningIcon,
      label: "Pipeline Velocity",
      sublabel: "Won Revenue Generated per Day",
      value:
        pipelineVelocity === null
          ? "—"
          : `${compactCurrency(pipelineVelocity)}/day`,
      variant: "yellowCard",
      to: null,
      metrics: [
        {
          label: "Opportunities",
          value: kpis.totalOpportunities || 0,
        },
        {
          label: "Avg Cycle",
          value: `${kpis.avgDaysToClose || 0}d`,
          icon: TimerIcon,
        },
      ],
      title:
        "Opportunities created x average deal size x win rate, divided by average days to close -- roughly the RM of won revenue this pipeline generates per day. Deliberately mixes windows: the opportunity count is leads created this period, while deal size / win rate / cycle time are measured over deals WON this period. Shows \"—\" when no deals closed in the period.",
    },

    // ==========================================
    // EXECUTION, BOOKINGS & CONCENTRATION (SAP-side, backward-looking)
    // ==========================================

    // TILE 5: Sales Cycle (unchanged value, TrophyIcon moved to Win Rate above)
    {
      icon: TimerIcon,
      label: "Sales Cycle",
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

    // TILE 6: Invoice Budget Attainment (Forecast 2 -- SAP, system-of-record)
    {
      icon: ReceiptIcon,
      label: "Invoice Budget Attainment",
      sublabel: "Invoiced Revenue (SAP) vs Revenue Budget",
      value: `${budgetAttainmentPct}%`,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "Invoiced Revenue",
          value: compactCurrency(totalInvoiced),
        },
        {
          label: "Revenue Budget",
          value: compactCurrency(totalBudget),
        },
      ],
      title:
        "Backward-looking, audited signal -- SAP-recognized invoice revenue (sap_invoices) vs a manually-set revenue budget (sales_budgets, not an SAP figure itself -- only the actuals it's compared against are SAP). May legitimately disagree with Pipeline Attainment -- that's expected for a CRM (self-reported) vs ERP (audited) pairing, not a bug.",
    },

    // TILE 7: Order Book (subs cleaned -- Win Rate/Avg Deal Size moved to
    // their own tile above; Backlog Gap replaces them, reconciling with
    // Invoice Budget Attainment's own Invoiced figure).
    {
      icon: FileTextIcon,
      label: "Sales Order Book",
      sublabel: "SAP Sales Orders Booked (This Period)",
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
        "Value of SAP sales orders booked this period -- a leading indicator sitting between pipeline commitment and invoiced revenue. Backlog Gap is Sales Order value minus Invoiced Revenue from the tile to the left: positive means orders booked this period haven't all been billed yet; negative means invoicing outpaced new bookings, e.g. billing against orders booked earlier.",
    },

    // TILE 8: Client Concentration -- new, 100% client-side, no RPC change.
    // Named "Client" (not "Customer") to match this page's CRM-native
    // `clients` table and its own "Top Clients" chart -- Finance Reports'
    // "Customer" tiles/charts are a different table (SAP customer_code on
    // sap_invoices), deliberately not the same word.
    {
      icon: UsersThreeIcon,
      label: "Client Concentration",
      sublabel: "Top 5 Clients' Share of Won Revenue",
      value: concentrationPct === null ? "—" : `${concentrationPct}%`,
      variant: "redCard",
      to: null,
      metrics: [
        {
          label: "Top 5 Revenue",
          value: compactCurrency(top5WonRevenue),
        },
        {
          label: "Top Client",
          value: topClients[0]?.name ?? "—",
        },
      ],
      title:
        "Share of this period's WON revenue held by the 5 largest accounts (the clients table, CRM-native -- not SAP's customer_code) -- above roughly 60% means the department's number depends on a handful of relationships. Slightly conservative: the denominator is total WON revenue including leads with no client record, which the top-clients breakdown can't attribute to any single account.",
    },
  ];
}

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
import { getStatusVariant } from "../../../../../functions/statusVariant";

/**
 * O2C funnel restructure (added 2026-08, see
 * docs/SALES-REPORTS-RESTRUCTURE-PLAN.md) -- reordered from the prior
 * "SAP block then CRM block" arrangement (2026-07 rebalance) into the
 * actual Order-to-Cash business process this page reports on: Pipeline ->
 * Sales Order -> Invoice -> Payment. Row 1 is one tile per O2C stage, in
 * stage order; Row 2 is each stage's own diagnostic. This is a pure reorder
 * of the same 8 tiles -- no tile's own value/variant/status/metrics
 * computation changed. Deliberately revisits the 2026-07 decision to lead
 * with SAP-side tiles ("that's what the business runs on") in favor of a
 * funnel-first narrative -- severity/urgency signaling stays independent of
 * grid position (getStatusVariant's fill rule already means a
 * critical-severity tile visually dominates regardless of slot), so this
 * changes narrative sequence, not risk-visibility. See
 * SALES-REPORTS-RESTRUCTURE-PLAN.md Part 4 for the full rationale.
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
 *
 * Drill-through pass (Phase 4): `filters` is this page's own active Owner/
 * Product Type/period filters, `canAccessInvoices`/`canAccessPayments` mirror
 * `canAccessOrders` (computed in Reports.jsx via canAccess({departments:
 * ["FIN"]})) -- Invoices/Payments are FIN-only while this page is SAL/MGM,
 * so every link into them must degrade to `to: null` for a viewer who can't
 * actually open the target, same pattern Finance's own dashboard already
 * uses for its cross-page links. Owner/Product Type only ever thread into
 * the CRM-side tiles (Pipeline Attainment/Pipeline Health/Win Rate/Sales
 * Cycle) -- confirmed via the RPC that they scope base_leads only, with zero
 * effect on any SAP-sourced KPI (Order Book, Invoiced, Collected, Customer
 * Concentration), so threading them into a SAP tile's link would
 * misrepresent what actually scoped that number.
 */
export function getSalesReportsOverviewConfig(
  kpis,
  scorecard = [],
  topInvoicedCustomers = [],
  canAccessOrders = false,
  canAccessInvoices = false,
  canAccessPayments = false,
  filters = {},
) {
  const totalBudget = scorecard.reduce(
    (sum, r) => sum + (r.budget_revenue || 0),
    0,
  );
  // Invoiced total now reads kpis.totalInvoiced (added 2026-07) instead of
  // summing the scorecard client-side -- same number in the common case,
  // slightly more correct in an edge case the scorecard's own WHERE drops
  // (a net-negative-invoiced rep with no orders/collections/budget).
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
  const top5Invoiced = [...topInvoicedCustomers]
    .sort((a, b) => (b.revenue_myr || 0) - (a.revenue_myr || 0))
    .slice(0, 5);
  const top5InvoicedRevenue = top5Invoiced.reduce(
    (sum, r) => sum + (r.revenue_myr || 0),
    0,
  );
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

  // Dynamic tile severity (see docs/DASHBOARD-CONVENTIONS.md's "KPI Card
  // Color & Fill Convention"). Thresholds below are documented estimates,
  // not audited Sales targets -- tune freely without touching
  // statusVariant.js. This page ends with zero permanently-filled tiles by
  // design: its two forecasts are "deliberately never blended" (see header
  // comment), so no single tile is crowned a fixed hero.
  const invoiceBudgetStatus = getStatusVariant(budgetAttainmentPct, {
    direction: "high-good",
    thresholds: { warningAt: 80, goodAt: 100 },
  });
  // Borrowed signal: same 70/90 collection-rate band as Finance Reports'
  // Cash Collected -- same RCT2 chain, must read the same on both dashboards.
  const paymentsCollectedStatus = getStatusVariant(kpis.collectionRatePct, {
    direction: "high-good",
    thresholds: { warningAt: 70, goodAt: 90 },
  });
  // concentrationPct is null when there's no invoiced revenue to divide by --
  // getStatusVariant renders that as neutral/informational, not a guessed
  // "good" (the old static-ternary version silently read a null as green).
  const concentrationStatus = getStatusVariant(concentrationPct, {
    direction: "low-good",
    thresholds: { warningAt: 30, criticalAt: 60 },
  });
  const pipelineAttainmentStatus = getStatusVariant(
    kpis.pipelineAttainmentPct || 0,
    { direction: "high-good", thresholds: { warningAt: 80, goodAt: 100 } },
  );
  // coverageRatio is null when there's no pipeline target set this period --
  // renders neutral, not a guessed critical.
  const pipelineHealthStatus = getStatusVariant(coverageRatio, {
    direction: "high-good",
    thresholds: { warningAt: 1.5, goodAt: 3 },
  });
  const winRateStatus = getStatusVariant(kpis.winRatePct || 0, {
    direction: "high-good",
    thresholds: { warningAt: 25, goodAt: 40 },
  });
  const salesCycleStatus = getStatusVariant(kpis.avgDaysToClose || 0, {
    direction: "low-good",
    thresholds: { warningAt: 31, criticalAt: 46 },
  });

  // CRM-side filters only -- Owner/Product Type never thread into SAP tiles
  // (see header comment).
  const baseFilterCRM = {
    ...(filters.owner && { owner: filters.owner }),
    ...(filters.productType && { productType: filters.productType }),
  };

  const isPeriodFiltered =
    Boolean(filters.startDate) && Boolean(filters.endDate);
  // created_at window -- universal across SAP and CRM tiles.
  const periodFilter = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};
  // closed_date window (Sales Leads' view-only column) -- backs Won/Lost/
  // cycle-time CRM tiles, which are windowed by when a deal closed.
  const closedPeriodFilter = isPeriodFiltered
    ? { closedDateFrom: filters.startDate, closedDateTo: filters.endDate }
    : {};

  return [
    // ==========================================
    // ROW 1 -- O2C FUNNEL STAGES, IN ORDER
    // Pipeline (CRM, self-reported) -> Sales Order (SAP, booked) ->
    // Invoice (SAP, billed) -> Payment (SAP, collected)
    // ==========================================

    // TILE 1 (Pipeline stage): Pipeline Attainment (Forecast 1 -- CRM, self-reported)
    {
      icon: GaugeIcon,
      label: "Leads Pipeline Attainment",
      sublabel: "CRM, self-reported at deal-close, vs quota",
      value: `${kpis.pipelineAttainmentPct || 0}%`,
      variant: pipelineAttainmentStatus.variant,
      status: {
        icon: pipelineAttainmentStatus.statusIcon,
        label: pipelineAttainmentStatus.statusLabel,
      },
      to: "../leads/list",
      filter: { ...baseFilterCRM, stage: "WON", ...closedPeriodFilter },
      metrics: [
        {
          label: "Pipeline Won Revenue",
          value: compactCurrency(kpis.pipelineWonRevenue),
          to: "../leads/list",
          filter: { ...baseFilterCRM, stage: "WON", ...closedPeriodFilter },
        },
        {
          label: "Pipeline Target",
          value: compactCurrency(kpis.pipelineTargetRevenue),
          // Manually-set quota (sales_targets) -- no list page, unlinked.
        },
      ],
      title:
        "Forward-looking pipeline/coaching signal -- reps' own declared revenue at deal-close (sales_leads), vs a manually-set monthly quota (sales_targets).",
    },

    // TILE 2 (Sales Order stage): Sales Order Book
    {
      icon: FileTextIcon,
      label: "Sales Order Book",
      sublabel: "Sales Orders Booked (This Period)",
      value: compactCurrency(kpis.orderBookValue),
      // Informational -- no computable comparator (Backlog Gap sub-metric's
      // own polarity is ambiguous: could mean healthy backlog or billing lag).
      variant: "blueCard",
      // Only a real link for viewers who can actually open sales/orders (SAL
      // managers, MGM excluded per R3) -- otherwise falls back to
      // OverviewCards' plain non-clickable card, same as every `to: null`
      // tile, so a viewer without access never sees a dead link.
      to: canAccessOrders ? "../orders" : null,
      filter: { ...periodFilter },
      metrics: [
        {
          label: "Sales Orders",
          value: kpis.orderBookCount || 0,
          to: canAccessOrders ? "../orders" : null,
          filter: { ...periodFilter },
        },
        {
          label: "Backlog Gap",
          value: compactCurrency(backlogGap),
          // Spans two tables/date-windows (Orders minus Invoices) -- no
          // single row-set, stays unlinked.
        },
      ],
      title:
        "Value of Sales Orders booked this period. Backlog Gap is Sales Order value minus Invoiced Revenue: positive means orders booked this period haven't all been billed yet; negative means invoicing outpaced new bookings, e.g. billing against orders booked earlier.",
    },

    // TILE 3 (Invoice stage): Invoice Budget Attainment (Forecast 2 -- SAP, system-of-record)
    {
      icon: ReceiptIcon,
      label: "Invoice Budget Attainment",
      sublabel: "Invoiced Revenue vs Invoice Budget (This Period)",
      value: `${budgetAttainmentPct}%`,
      variant: invoiceBudgetStatus.variant,
      status: {
        icon: invoiceBudgetStatus.statusIcon,
        label: invoiceBudgetStatus.statusLabel,
      },
      // Only a real link for viewers who can actually open finance/invoices
      // (FIN department) -- otherwise falls back to OverviewCards' plain
      // non-clickable card.
      to: canAccessInvoices ? "/app/finance/invoices" : null,
      filter: { ...periodFilter },
      metrics: [
        {
          label: "Invoiced Revenue",
          value: compactCurrency(kpis.totalInvoiced),
          to: canAccessInvoices ? "/app/finance/invoices" : null,
          filter: { ...periodFilter },
        },
        {
          label: "Revenue Budget",
          value: compactCurrency(totalBudget),
          // Manually-set per-rep quota (sales_budgets) -- no list page
          // exists for it, stays unlinked.
        },
      ],
      title: "Backward-looking, Invoiced Revenue VS Invoice Budget.",
    },

    // TILE 4 (Payment stage): Payments Collected
    {
      icon: WalletIcon,
      label: "Payments Collected",
      sublabel: "Total Collected (This Period)",
      value: compactCurrency(kpis.totalCollected),
      variant: paymentsCollectedStatus.variant,
      status: {
        icon: paymentsCollectedStatus.statusIcon,
        label: paymentsCollectedStatus.statusLabel,
      },
      to: canAccessPayments ? "/app/finance/payments" : null,
      filter: { ...periodFilter },
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

    // ==========================================
    // ROW 2 -- STAGE DIAGNOSTICS
    // Each tile below diagnoses the row-1 tile directly above it.
    // ==========================================

    // TILE 5 (diagnoses Pipeline): Pipeline Health -- merged 2026-07 from the
    // previous separate Pipeline Coverage + Pipeline Velocity tiles.
    {
      icon: StackIcon,
      label: "Leads Pipeline Health",
      sublabel: "Open Pipeline (Today) vs This Period's Quota",
      value: formatRatio(coverageRatio),
      variant: pipelineHealthStatus.variant,
      status: {
        icon: pipelineHealthStatus.statusIcon,
        label: pipelineHealthStatus.statusLabel,
      },
      // Live snapshot, ignores the date filter (see title) -- no period
      // filter threaded through, only Owner/Product Type.
      to: "../leads/list",
      filter: { ...baseFilterCRM, activePipelineOnly: "true" },
      metrics: [
        {
          label: "Pipeline Value",
          value: compactCurrency(kpis.activePipelineValue),
          to: "../leads/list",
          filter: { ...baseFilterCRM, activePipelineOnly: "true" },
        },
        {
          label: "Velocity",
          value:
            pipelineVelocity === null
              ? "—"
              : `${compactCurrency(pipelineVelocity)}/day`,
          icon: LightningIcon,
          // Derived rate (RM/day) -- no matching row-set, unlinked.
        },
      ],
      title:
        "Coverage: Current Active Pipeline divided by Leads Target (Quota) -- Roughly 3x is a healthy coverage floor. Live snapshot, ignores the date filter. Velocity: Lead Opportunities Created X Average Deal Size X Win Rate divided by Average Days to Close -- Roughly the RM of won revenue this pipeline generates per day. Opportunity Count = leads created this period. Deal size/win rate/cycle time are measured over deals WON this period. Weighted pipeline (applying each lead's own close probability): " +
        `${compactCurrency(kpis.weightedPipelineValue)}.`,
    },

    // TILE 6 (diagnoses Pipeline): Win Rate -- linkable via the
    // closedOnly/hasQuotation filters (leadsService.js).
    {
      icon: TrophyIcon,
      label: "Leads Win Rate",
      sublabel: "WON vs WON + LOST (This Period)",
      value: `${kpis.winRatePct || 0}%`,
      variant: winRateStatus.variant,
      status: { icon: winRateStatus.statusIcon, label: winRateStatus.statusLabel },
      to: "../leads/list",
      filter: { ...baseFilterCRM, closedOnly: "true", ...closedPeriodFilter },
      metrics: [
        {
          label: "Avg Deal Size",
          value: compactCurrency(kpis.avgDealSize),
          to: "../leads/list",
          filter: { ...baseFilterCRM, stage: "WON", ...closedPeriodFilter },
        },
        {
          label: "Quote → Win",
          value: `${kpis.quoteToWinConversionPct || 0}%`,
          icon: PercentIcon,
          to: "../leads/list",
          filter: {
            ...baseFilterCRM,
            hasQuotation: "true",
            ...closedPeriodFilter,
          },
        },
      ],
      title:
        "WON deals as a share of WON + LOST closed in this period (cancelled leads excluded). Quote → Win is the narrower funnel: of leads that had a quotation sent, how many closed WON.",
    },

    // TILE 7 (diagnoses Pipeline): Sales Cycle -- CRM/sales_leads-sourced
    // deal cycle time.
    {
      icon: TimerIcon,
      label: "Sales Leads Cycle",
      sublabel: "Avg Days to Close (This Period)",
      value: `${kpis.avgDaysToClose || 0}d`,
      variant: salesCycleStatus.variant,
      status: { icon: salesCycleStatus.statusIcon, label: salesCycleStatus.statusLabel },
      to: "../leads/list",
      filter: { ...baseFilterCRM, stage: "WON", ...closedPeriodFilter },
      metrics: [
        {
          label: "Median Days to Win",
          value: `${kpis.medianDaysToWin || 0}d`,
          to: "../leads/list",
          filter: { ...baseFilterCRM, stage: "WON", ...closedPeriodFilter },
        },
      ],
      title:
        "Average days from lead creation to a WON deal this period, and the median version of the same measure (less sensitive to a handful of unusually slow or fast deals).",
    },

    // TILE 8 (diagnoses Invoice): Customer Concentration -- converted
    // 2026-07 from CRM ("Client Concentration") to SAP-invoiced revenue.
    // 100% RPC-fed, no extra query beyond topInvoicedCustomersData/
    // totalInvoiced already needed elsewhere on this page.
    {
      icon: UsersThreeIcon,
      label: "Customer Concentration",
      sublabel: "Top 5 Customers' Share of Invoiced Revenue",
      value: concentrationPct === null ? "—" : `${concentrationPct}%`,
      variant: concentrationStatus.variant,
      status: {
        icon: concentrationStatus.statusIcon,
        label: concentrationStatus.statusLabel,
      },
      // customerCodes (plural) links all 5 at once -- see invoicesService.js.
      to: canAccessInvoices ? "/app/finance/invoices" : null,
      filter: {
        customerCodes: top5Invoiced.map((c) => c.customer_code).join(","),
        ...periodFilter,
      },
      metrics: [
        {
          label: "Top 5 Revenue",
          value: compactCurrency(top5InvoicedRevenue),
          to: canAccessInvoices ? "/app/finance/invoices" : null,
          filter: {
            customerCodes: top5Invoiced.map((c) => c.customer_code).join(","),
            ...periodFilter,
          },
        },
        {
          label: "Top Customer",
          value: topInvoicedCustomers[0]?.customer_name ?? "—",
          to:
            canAccessInvoices && topInvoicedCustomers[0]?.customer_code
              ? "/app/finance/invoices"
              : null,
          filter: {
            customerCode: topInvoicedCustomers[0]?.customer_code,
            ...periodFilter,
          },
        },
      ],
      title:
        "Share of this period's invoiced revenue held by the 5 largest accounts. Above 60% means the department's number depends on a handful of relationships.",
    },
  ];
}

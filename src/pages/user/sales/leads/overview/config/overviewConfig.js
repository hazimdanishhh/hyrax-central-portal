import {
  CurrencyDollarIcon,
  FunnelIcon,
  HandshakeIcon,
  WarningCircleIcon,
  TrendUpIcon,
  TrendDownIcon,
  ScalesIcon,
  ClockIcon,
  PercentIcon,
  LightningIcon,
  TargetIcon,
  PauseCircleIcon,
  XCircleIcon,
  HourglassHighIcon,
} from "@phosphor-icons/react";
import { getStatusVariant } from "../../../../../../functions/statusVariant";

// Drill-through pass: `filters` is the Overview's own active owner/client/
// leadSourceType/period (and any of stage/onHold/cancelled/productType that
// happen to be set, even though the Overview's own filter bar doesn't expose
// those controls today -- fetchLeadsDashboard.js still honors them from the
// URL) -- threaded into every link below so a tile click never silently
// drops what the user had already narrowed down to.
//
// Sales Leads' period-bound KPIs default to ALL-TIME when no date range is
// selected (every RPC condition collapses to true when p_start_date is
// null) -- unlike Attendance's month-to-date default, periodFilter/
// closedPeriodFilter below are correctly just {} when unset.
export function getLeadsOverviewConfig(kpis, targetData, filters = {}) {
  const isVariancePositive = (kpis.forecastVariance || 0) >= 0;

  // ==========================================
  // NEW: TARGET & PACING CALCULATIONS
  // ==========================================
  const wonRevenue = kpis.wonRevenue || 0;
  const targetRevenue = targetData?.total_prorated_target || 0;

  const pacingPercentage =
    targetRevenue > 0 ? Math.round((wonRevenue / targetRevenue) * 100) : 0;

  const wonSublabel =
    targetRevenue > 0
      ? `${pacingPercentage}% of RM ${targetRevenue.toLocaleString()} Target`
      : "Total Actual Revenue (No Target Set)";

  // Calculate percentage change function
  const calcDelta = (current, previous) => {
    // 1. If SQL explicitly returned null (meaning no date filter was applied)
    if (previous === null || previous === undefined) return null;

    // 2. If both periods had 0 revenue
    if (previous === 0 && current === 0) return 0;

    // 3. If we had 0 last month, and made money this month (100% Growth)
    if (previous === 0 && current > 0) return 100;

    // 4. Standard calculation
    return Math.round(((current - previous) / previous) * 100);
  };

  const wonDelta = calcDelta(kpis.wonRevenue, kpis.prevWonRevenue);
  const wonDeltaText =
    wonDelta !== null
      ? wonDelta > 0
        ? `↑ ${wonDelta}% vs last period`
        : `↓ ${Math.abs(wonDelta)}% vs last period`
      : "No prior data";

  // Dynamic tile severity (see docs/DASHBOARD-CONVENTIONS.md's "KPI Card
  // Color & Fill Convention"). Thresholds below are documented estimates,
  // not audited Sales targets -- tune freely without touching
  // statusVariant.js. Same 80/100 attainment band as Sales Reports' own
  // attainment-style tiles -- keep in sync.
  const revenueAttainmentStatus = getStatusVariant(pacingPercentage, {
    direction: "high-good",
    thresholds: { warningAt: 80, goodAt: 100 },
  });
  const lostRevenue = kpis.lostRevenue || 0;
  const lostRevenueSharePct =
    wonRevenue + lostRevenue > 0
      ? (lostRevenue / (wonRevenue + lostRevenue)) * 100
      : 0;
  const lostRevenueStatus = getStatusVariant(lostRevenueSharePct, {
    direction: "low-good",
    thresholds: { warningAt: 20, criticalAt: 40 },
  });

  // Backlog count, not a period metric (see get_sales_leads_dashboard_rpc.sql)
  // -- thresholds are a starting estimate, tune freely without touching
  // statusVariant.js.
  const pendingSapOrderStatus = getStatusVariant(
    kpis.wonLeadsPendingSapOrderCount || 0,
    {
      direction: "low-good",
      thresholds: { warningAt: 1, criticalAt: 5 },
    },
  );

  // Carried into every link below -- the Overview's own narrowing, so a tile
  // click never silently resets it.
  const baseFilter = {
    ...(filters.owner && { owner: filters.owner }),
    ...(filters.client && { client: filters.client }),
    ...(filters.leadSourceType && { leadSourceType: filters.leadSourceType }),
    ...(filters.stage && { stage: filters.stage }),
    ...(filters.onHold && { onHold: filters.onHold }),
    ...(filters.cancelled && { cancelled: filters.cancelled }),
    ...(filters.productType && { productType: filters.productType }),
  };

  const isPeriodFiltered =
    Boolean(filters.startDate) && Boolean(filters.endDate);
  // created_at window -- backs "generated" KPIs (Leads Created, Pipeline
  // Generated).
  const periodFilter = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};
  // closed_date window (view-only column, see sales_leads_with_closed_date.sql)
  // -- backs Won/Lost/Cancelled KPIs, which are windowed by when a deal
  // closed, not when it was created.
  const closedPeriodFilter = isPeriodFiltered
    ? { closedDateFrom: filters.startDate, closedDateTo: filters.endDate }
    : {};

  return [
    // ==========================================
    // PILLAR 1: Current Health (What are we working on?)
    // ==========================================
    {
      icon: CurrencyDollarIcon,
      label: "Active Pipeline",
      sublabel: "Total Active Expected Revenue",
      value: `RM ${(kpis.activePipelineValue || 0).toLocaleString()}`,
      variant: "blueCardFill",
      to: "../list",
      filter: { ...baseFilter, activePipelineOnly: "true" },
      metrics: [
        {
          label: "Active Leads",
          value: kpis.activeLeads || 0,
          to: "../list",
          filter: { ...baseFilter, activePipelineOnly: "true" },
        },
        {
          label: "Weighted Pipeline",
          value: `RM ${(kpis.weightedPipelineValue || 0).toLocaleString()}`,
          icon: ScalesIcon,
          // Derived weighted sum (expected_revenue * probability) -- no
          // matching row-set, left unlinked.
        },
        {
          label: "In Negotiation",
          value: `RM ${(kpis.negotiationPipeline || 0).toLocaleString()}`,
          icon: TargetIcon,
          to: "../list",
          filter: {
            ...baseFilter,
            stage: "NEGOTIATION",
            cancelled: "false",
            onHold: "false",
          },
        },
        {
          label: "On-Hold Cash",
          value: `RM ${(kpis.onHoldPipeline || 0).toLocaleString()}`,
          icon: PauseCircleIcon,
          to: "../list",
          filter: { ...baseFilter, activePipelineOnly: "true", onHold: "true" },
        },
      ],
      title:
        "Current pipeline health -- not date-bound (unlike every other tile here), since this is a snapshot of what's open right now, not what happened in a period.",
    },

    // ==========================================
    // PILLAR 2: Top of Funnel (What came in?)
    // ==========================================
    {
      icon: FunnelIcon,
      label: "Pipeline Generated",
      sublabel: "Total Generated Expected Revenue",
      value: `RM ${(kpis.pipelineGenerated || 0).toLocaleString()}`,
      variant: "blueCard",
      to: "../list",
      filter: { ...baseFilter, ...periodFilter },
      metrics: [
        {
          label: "Leads Created",
          value: kpis.totalLeadsCreated || 0,
          to: "../list",
          filter: { ...baseFilter, ...periodFilter },
        },
        {
          label: "Avg. Deal Size",
          value: `RM ${(kpis.avgGeneratedDealSize || 0).toLocaleString()}`,
        },
        {
          label: "Avg. Probability",
          value: `${kpis.avgGeneratedProbability || 0}%`,
          icon: PercentIcon,
        },
        {
          label: "Fast Track Deals",
          value: kpis.fastTrackDeals || 0,
          icon: LightningIcon,
          // Needs BOTH windows simultaneously -- created_at in period AND
          // closed_date in the same period -- mirrors fastTrackDeals' own
          // dual-window formula exactly.
          to: "../list",
          filter: {
            ...baseFilter,
            stage: "WON",
            ...periodFilter,
            ...closedPeriodFilter,
          },
        },
      ],
    },

    // ==========================================
    // PILLAR 3: Success & Accuracy (Did we hit the goal?)
    // ==========================================
    {
      icon: TargetIcon, // CHANGED: From Handshake to Target to emphasize goals
      // Relabeled 2026-08 (Duality B disclosure, per DASHBOARD-ROADMAP.md
      // §5): this is the CRM's own self-reported pipeline number
      // (sales_leads.actual_revenue vs. sales_targets), not SAP-recognized
      // revenue -- Sales Reports'/Finance's per-rep figures are sourced from
      // sap_invoices instead and won't generally match this one. Not a bug
      // to reconcile; both are legitimate, deliberately unblended.
      label: "Pipeline Attainment (CRM)",
      sublabel:
        targetRevenue > 0
          ? `Self-Reported vs. Target Quota: RM ${targetRevenue.toLocaleString()}`
          : "No Target Set for Period",
      value: `RM ${wonRevenue.toLocaleString()}`, // Keep the massive number as the actual cash
      variant: revenueAttainmentStatus.variant,
      status: {
        icon: revenueAttainmentStatus.statusIcon,
        label: revenueAttainmentStatus.statusLabel,
      },
      to: "../list",
      filter: { ...baseFilter, stage: "WON", ...closedPeriodFilter },
      title:
        "CRM pipeline attainment -- self-reported (sales_leads.actual_revenue, manually typed by the rep) vs. quota (sales_targets). Distinct from Sales Reports'/Finance's SAP-recognized invoiced-revenue per-rep figures, which are audited and backward-looking; this figure is forward-looking and not independently verified. Both are legitimate, deliberately not blended into one number.",
      metrics: [
        {
          label: "Prev. Period (Delta)", // Updated label to reflect the new data
          value:
            wonDelta !== null
              ? `RM ${(kpis.prevWonRevenue || 0).toLocaleString()} (${wonDelta > 0 ? "+" : ""}${wonDelta}%)`
              : "N/A",
          icon:
            wonDelta === null
              ? null
              : wonDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
        {
          label: "Quota Attainment", // NEW: Pushed to the very top of the list
          value: `${pacingPercentage}%`,
          icon: pacingPercentage >= 100 ? TrendUpIcon : TrendDownIcon,
        },
        {
          label: "Forecast Variance", // Accuracy metric stays high up
          value: `RM ${(kpis.forecastVariance || 0).toLocaleString()}`,
          icon: isVariancePositive ? TrendUpIcon : TrendDownIcon,
        },
        {
          label: "Win Rate",
          value: `${kpis.winRate || 0}%`,
          icon: PercentIcon,
        },
      ],
    },

    {
      icon: WarningCircleIcon,
      label: "Pending SAP Order Entry",
      sublabel: "WON Leads Without a Matching SAP Order (Not Based on Period)",
      value: kpis.wonLeadsPendingSapOrderCount || 0,
      variant: pendingSapOrderStatus.variant,
      status: {
        icon: pendingSapOrderStatus.statusIcon,
        label: pendingSapOrderStatus.statusLabel,
      },
      to: "../list",
      filter: { ...baseFilter, stage: "WON", pendingSapOrder: "true" },
      title:
        "WON leads with a PO number typed in, but no SAP sales order has been created for that PO yet -- the sales admin still needs to enter it into SAP.",
    },

    // ==========================================
    // PILLAR 4: Friction & Misses (What did we lose?)
    // ==========================================
    {
      icon: WarningCircleIcon,
      label: "Lost Revenue",
      sublabel: "Expected Revenue (Lost/Cancelled)",
      value: `RM ${lostRevenue.toLocaleString()}`,
      variant: lostRevenueStatus.variant,
      status: {
        icon: lostRevenueStatus.statusIcon,
        label: lostRevenueStatus.statusLabel,
      },
      // stage and is_cancelled are orthogonal columns -- a lead can be
      // cancelled from any stage, not just LOST. lostOrCancelled mirrors
      // lostRevenue/lostLeads' own (stage='LOST' OR is_cancelled) union
      // exactly (previously this linked stage=LOST only, silently dropping
      // every cancelled-but-not-LOST lead from the linked list).
      to: "../list",
      filter: { ...baseFilter, lostOrCancelled: "true", ...closedPeriodFilter },
      metrics: [
        {
          label: "Total Lost Deals",
          value: kpis.lostLeads || 0,
          to: "../list",
          filter: {
            ...baseFilter,
            lostOrCancelled: "true",
            ...closedPeriodFilter,
          },
        },
        {
          label: "Avg. Lost Deal Size",
          value: `RM ${(kpis.avgLostDealSize || 0).toLocaleString()}`,
          // Computed off stage='LOST' only (NOT the cancelled union above --
          // a pre-existing inconsistency between sibling metrics on this
          // tile, in the RPC itself, not something introduced here) -- links
          // to that narrower population rather than the tile's own union.
          to: "../list",
          filter: { ...baseFilter, stage: "LOST", ...closedPeriodFilter },
        },
        {
          label: "Avg. Lost Cycle",
          value: `${kpis.avgLostCycle || 0} Days`,
          icon: HourglassHighIcon,
          to: "../list",
          filter: { ...baseFilter, stage: "LOST", ...closedPeriodFilter },
        },
        {
          label: "Cancelled / Junk",
          value: kpis.cancelledLeads || 0,
          icon: XCircleIcon,
          to: "../list",
          filter: { ...baseFilter, cancelled: "true", ...closedPeriodFilter },
        },
      ],
      title:
        "Lost Revenue and Total Lost Deals count both LOST-stage leads and cancelled leads (from any stage) together. Avg. Lost Deal Size and Avg. Lost Cycle are narrower -- LOST-stage leads only, excluding cancelled-but-not-LOST leads -- matching how the dashboard itself computes them.",
    },
  ];
}

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

export function getLeadsOverviewConfig(kpis, targetData) {
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
      filter: null,
      metrics: [
        {
          label: "Active Leads",
          value: kpis.activeLeads || 0,
        },
        {
          label: "Weighted Pipeline",
          value: `RM ${(kpis.weightedPipelineValue || 0).toLocaleString()}`,
          icon: ScalesIcon,
        },
        {
          label: "In Negotiation",
          value: `RM ${(kpis.negotiationPipeline || 0).toLocaleString()}`,
          icon: TargetIcon,
        },
        {
          label: "On-Hold Cash",
          value: `RM ${(kpis.onHoldPipeline || 0).toLocaleString()}`,
          icon: PauseCircleIcon,
        },
      ],
      title: "Current Pipeline Health (Not based on filters)",
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
      filter: null,
      metrics: [
        {
          label: "Leads Created",
          value: kpis.totalLeadsCreated || 0,
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
        },
      ],
    },

    // ==========================================
    // PILLAR 3: Success & Accuracy (Did we hit the goal?)
    // ==========================================
    {
      icon: TargetIcon, // CHANGED: From Handshake to Target to emphasize goals
      label: "Revenue Attainment", // CHANGED: More executive-focused than just "Won"
      sublabel:
        targetRevenue > 0
          ? `Target Quota: RM ${targetRevenue.toLocaleString()}`
          : "No Target Set for Period",
      value: `RM ${wonRevenue.toLocaleString()}`, // Keep the massive number as the actual cash
      variant: "greenCard",
      filter: { stage: "WON" },
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

    // ==========================================
    // PILLAR 4: Friction & Misses (What did we lose?)
    // ==========================================
    {
      icon: WarningCircleIcon,
      label: "Lost Revenue",
      sublabel: "Expected Revenue (Lost/Cancelled)",
      value: `RM ${(kpis.lostRevenue || 0).toLocaleString()}`,
      variant: "redCard",
      filter: { stage: "LOST" },
      metrics: [
        {
          label: "Total Lost Deals",
          value: kpis.lostLeads || 0,
        },
        {
          label: "Avg. Lost Deal Size",
          value: `RM ${(kpis.avgLostDealSize || 0).toLocaleString()}`,
        },
        {
          label: "Avg. Lost Cycle",
          value: `${kpis.avgLostCycle || 0} Days`,
          icon: HourglassHighIcon,
        },
        {
          label: "Cancelled / Junk",
          value: kpis.cancelledLeads || 0,
          icon: XCircleIcon,
        },
      ],
    },
  ];
}

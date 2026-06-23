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

export function getLeadsOverviewConfig(kpis) {
  const isVariancePositive = (kpis.forecastVariance || 0) >= 0;

  return [
    // ==========================================
    // PILLAR 1: Top of Funnel (What came in?)
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
          label: "Fast Track Deals", // Deals created AND won in the exact same period
          value: kpis.fastTrackDeals || 0,
          icon: LightningIcon,
        },
      ],
    },

    // ==========================================
    // PILLAR 2: Current Health (What are we working on?)
    // ==========================================
    {
      icon: CurrencyDollarIcon,
      label: "Active Pipeline",
      sublabel: "Total Active Expected Revenue",
      value: `RM ${(kpis.activePipelineValue || 0).toLocaleString()}`,
      variant: "blueCard",
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
          label: "In Negotiation", // Near-term cash
          value: `RM ${(kpis.negotiationPipeline || 0).toLocaleString()}`,
          icon: TargetIcon,
        },
        {
          label: "On-Hold Cash", // Stuck pipeline, management red flag
          value: `RM ${(kpis.onHoldPipeline || 0).toLocaleString()}`,
          icon: PauseCircleIcon,
        },
      ],
    },

    // ==========================================
    // PILLAR 3: Success & Accuracy (What did we win?)
    // ==========================================
    {
      icon: HandshakeIcon,
      label: "Won Revenue",
      sublabel: "Total Actual Revenue",
      value: `RM ${(kpis.wonRevenue || 0).toLocaleString()}`,
      variant: "greenCard",
      filter: { stage: "WON" },
      metrics: [
        {
          label: "Win Rate",
          value: `${kpis.winRate || 0}%`,
          icon: PercentIcon,
        },
        {
          label: "Avg. Deal Size",
          value: `RM ${(kpis.avgDealSize || 0).toLocaleString()}`,
        },
        {
          label: "Avg. Won Cycle", // Moved here to keep the Success metrics grouped
          value: `${kpis.avgDaysToClose || 0} Days`,
          icon: ClockIcon,
        },
        {
          label: "Forecast Variance",
          value: `RM ${(kpis.forecastVariance || 0).toLocaleString()}`,
          icon: isVariancePositive ? TrendUpIcon : TrendDownIcon,
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
          label: "Avg. Lost Deal Size", // Are we losing the whales?
          value: `RM ${(kpis.avgLostDealSize || 0).toLocaleString()}`,
        },
        {
          label: "Avg. Lost Cycle", // The 'Hopium' indicator. If higher than Won Cycle, reps are hoarding dead deals.
          value: `${kpis.avgLostCycle || 0} Days`,
          icon: HourglassHighIcon,
        },
        {
          label: "Cancelled / Junk", // Leads disqualified entirely
          value: kpis.cancelledLeads || 0,
          icon: XCircleIcon,
        },
      ],
    },
  ];
}

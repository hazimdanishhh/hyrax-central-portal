import {
  CurrencyDollarIcon,
  FunnelIcon,
  HandshakeIcon,
  PercentIcon,
  WarningCircleIcon,
  XIcon,
  ClockIcon,
  ScalesIcon,
  TrendUpIcon,
  TrendDownIcon,
} from "@phosphor-icons/react";

export function getLeadsOverviewConfig(kpis) {
  const isVariancePositive = (kpis.forecastVariance || 0) >= 0;

  return [
    {
      icon: FunnelIcon,
      label: "Active Leads",
      sublabel: "Ongoing",
      value: kpis.activeLeads,
      variant: "blueCard",
      filter: null,
    },
    {
      icon: CurrencyDollarIcon,
      label: "Active Pipeline",
      sublabel: "Total Expected Revenue",
      value: `RM ${(kpis.activePipelineValue || 0).toLocaleString()}`,
      variant: "blueCard",
      filter: null,
    },
    {
      icon: ScalesIcon,
      label: "Weighted Pipeline",
      sublabel: "Expected Revenue * Probability",
      value: `RM ${(kpis.weightedPipelineValue || 0).toLocaleString()}`,
      variant: "blueCard",
      filter: null,
    },
    {
      icon: WarningCircleIcon,
      label: "Lost Revenue",
      sublabel: "Expected Revenue (Lost/Cancelled)",
      value: `RM ${(kpis.lostRevenue || 0).toLocaleString()}`,
      variant: "redCard",
      filter: { stage: "LOST" },
    },
    {
      icon: HandshakeIcon,
      label: "Won Revenue",
      sublabel: "Total Actual Revenue",
      value: `RM ${(kpis.wonRevenue || 0).toLocaleString()}`,
      variant: "greenCard",
      filter: { stage: "WON" },
    },
    {
      icon: isVariancePositive ? TrendUpIcon : TrendDownIcon,
      label: "Forecast Variance",
      sublabel: "Expected - Actual Revenue",
      value: `RM ${(kpis.forecastVariance || 0).toLocaleString()}`,
      variant: isVariancePositive ? "greenCard" : "redCard",
      filter: null,
    },
    {
      icon: ClockIcon,
      label: "Avg. Days to Close",
      sublabel: "Avg. Won Time",
      value: `${kpis.avgDaysToClose || 0} Days`,
      variant: "blueCard",
      filter: null,
    },
    // {
    //   icon: XIcon,
    //   label: "Lost Leads",
    //   sublabel: "Total Lost / Cancelled",
    //   value: kpis.lostLeads,
    //   variant: "redCard",
    //   filter: { stage: "LOST" },
    // },
    {
      icon: PercentIcon,
      label: "Win Rate",
      sublabel: "Percentage of Won Deals",
      value: `${kpis.winRate || 0}%`,
      variant: kpis.winRate >= 50 ? "greenCard" : "redCard",
      filter: null,
    },
  ];
}

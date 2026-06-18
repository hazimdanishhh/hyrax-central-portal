import {
  CurrencyDollarIcon,
  FunnelIcon,
  HandshakeIcon,
  PercentIcon,
  WarningCircleIcon,
  XIcon,
  ClockIcon,
  ScalesIcon,
} from "@phosphor-icons/react";

export function getLeadsOverviewConfig(kpis) {
  return [
    {
      icon: FunnelIcon,
      label: "Active Leads",
      value: kpis.activeLeads,
      variant: "blueCard",
      filter: null,
    },
    {
      icon: CurrencyDollarIcon,
      label: "Active Pipeline",
      value: `RM ${(kpis.activePipelineValue || 0).toLocaleString()}`,
      variant: "blueCard",
      filter: null,
    },
    {
      icon: ScalesIcon,
      label: "Weighted Pipeline",
      value: `RM ${(kpis.weightedPipelineValue || 0).toLocaleString()}`,
      variant: "blueCard",
      filter: null,
    },
    {
      icon: WarningCircleIcon,
      label: "Lost Revenue",
      value: `RM ${(kpis.lostRevenue || 0).toLocaleString()}`,
      variant: "redCard",
      filter: { stage: "LOST" },
    },

    {
      icon: HandshakeIcon,
      label: "Won Revenue",
      value: `RM ${(kpis.wonRevenue || 0).toLocaleString()}`,
      variant: "greenCard",
      filter: { stage: "WON" },
    },
    {
      icon: ClockIcon,
      label: "Avg. Days to Close",
      value: `${kpis.avgDaysToClose || 0} Days`,
      variant: "blueCard",
      filter: null,
    },

    {
      icon: XIcon,
      label: "Lost Leads",
      value: kpis.lostLeads,
      variant: "redCard",
      filter: { stage: "LOST" },
    },
    {
      icon: PercentIcon,
      label: "Win Rate",
      value: `${kpis.winRate || 0}%`,
      variant: kpis.winRate >= 50 ? "greenCard" : "redCard",
      filter: null,
    },
  ];
}

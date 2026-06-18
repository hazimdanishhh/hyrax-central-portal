import {
  CurrencyDollarIcon,
  FunnelIcon,
  HandshakeIcon,
  PercentIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

export function getLeadsOverviewConfig(kpis) {
  return [
    {
      icon: FunnelIcon,
      label: "Total Leads",
      value: kpis.totalLeads,
      filter: null,
    },

    {
      icon: HandshakeIcon,
      label: "Active Leads",
      value: kpis.activeLeads,
      variant: "blueCard",
      filter: null,
    },

    {
      icon: HandshakeIcon,
      label: "Won Leads",
      value: kpis.wonLeads,
      variant: "greenCard",
      filter: { stage: "WON" },
    },

    {
      icon: WarningCircleIcon,
      label: "Lost Leads",
      value: kpis.lostLeads,
      variant: "redCard",
      filter: { stage: "LOST" },
    },

    {
      icon: XIcon,
      label: "Cancelled Leads",
      value: kpis.lostLeads,
      variant: "redCard",
      filter: { cancelled: "true" },
    },

    {
      icon: CurrencyDollarIcon,
      label: "Pipeline Value",
      value: kpis.totalPipelineValue,
      variant: "blueCard",
      filter: null,
    },

    {
      icon: PercentIcon,
      label: "Ave. Close Rate",
      value: kpis.avgCloseProbability,
      variant: kpis.avgCloseProbability > 50 ? "greenCard" : "redCard",
      filter: null,
    },
  ];
}

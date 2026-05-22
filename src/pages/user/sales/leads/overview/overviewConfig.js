import {
  CurrencyDollarIcon,
  FunnelIcon,
  HandshakeIcon,
  WarningCircleIcon,
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
      icon: CurrencyDollarIcon,
      label: "Pipeline Value",
      value: kpis.totalPipelineValueFormatted,
      variant: "blueCard",
      filter: null,
    },
  ];
}

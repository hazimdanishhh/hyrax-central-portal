import {
  CurrencyDollarIcon,
  FunnelIcon,
  HandshakeIcon,
  PercentIcon,
  PulseIcon,
  WarningCircleIcon,
  WarningDiamondIcon,
  XIcon,
} from "@phosphor-icons/react";

export function getLeadsOverviewConfig(kpis) {
  return [
    {
      icon: FunnelIcon,
      label: "Total",
      value: kpis.totalLeads,
      to: "/app/sales/leads/list",
      filter: null,
    },

    {
      icon: PulseIcon,
      label: "Active",
      value: kpis.activeLeads,
      variant: "blueCard",
      to: "/app/sales/leads/list",
      filter: { cancelled: "false", onHold: "false" },
    },

    {
      icon: HandshakeIcon,
      label: "Won",
      value: kpis.wonLeads,
      variant: "greenCard",
      to: "/app/sales/leads/list",
      filter: { stage: "WON" },
    },

    {
      icon: WarningCircleIcon,
      label: "Lost",
      value: kpis.lostLeads,
      variant: "redCard",
      to: "/app/sales/leads/list",
      filter: { stage: "LOST" },
    },

    {
      icon: WarningDiamondIcon,
      label: "On Hold",
      value: kpis.onHoldLeads,
      variant: "yellowCard",
      to: "/app/sales/leads/list",
      filter: { onHold: "true" },
    },

    {
      icon: XIcon,
      label: "Cancelled",
      value: kpis.cancelledLeads,
      variant: "redCard",
      to: "/app/sales/leads/list",
      filter: { cancelled: "true" },
    },

    {
      icon: CurrencyDollarIcon,
      label: "Pipeline Value",
      value: kpis.totalPipelineValueFormatted,
      variant: "blueCard",
      to: "/app/sales/leads/list",
      filter: null,
    },

    {
      icon: PercentIcon,
      label: "Win Rate",
      value: kpis.winRateFormatted,
      variant:
        kpis.winRate <= 30
          ? "redCard"
          : kpis.winRate >= 70
            ? "greenCard"
            : "yellowCard",
      to: "/app/sales/leads/list",
      filter: null,
    },
  ];
}

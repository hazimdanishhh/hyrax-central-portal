import {
  CheckCircleIcon,
  DesktopIcon,
  UserMinusIcon,
  WarningIcon,
} from "@phosphor-icons/react";

export function getAssetsOverviewConfig(kpis) {
  return [
    {
      label: "Total Assets",
      value: kpis.totalAssets,
      icon: DesktopIcon,
      filter: null,
    },
    {
      label: "Active Assets",
      value: kpis.activeAssets,
      icon: CheckCircleIcon,
      variant: "greenCard",
      filter: { status: 1 },
    },
    {
      label: "Risk Assets",
      value: kpis.riskAssets,
      icon: WarningIcon,
      variant: "redCard",
      filter: { condition: 3 },
    },
    {
      label: "Unassigned",
      value: kpis.unassignedAssets,
      icon: UserMinusIcon,
      variant: "yellowCard",
      filter: null,
    },
  ];
}

import {
  UserFocusIcon,
  MonitorIcon,
  UsersThreeIcon,
  PercentIcon,
  LaptopIcon,
} from "@phosphor-icons/react";

export function getAssetsOverviewConfig(summary) {
  return [
    {
      icon: MonitorIcon,
      label: "Total Assets",
      value: summary.total,
    },
    {
      icon: UsersThreeIcon,
      label: "Active Assets",
      value: summary.active,
      variant: "greenCard",
    },
    {
      icon: UsersThreeIcon,
      label: "Inactive Assets",
      value: summary.inactive,
      variant: "redCard",
    },
    {
      icon: PercentIcon,
      label: "Utilization Rate",
      value: summary.utilizationRate,
    },
    {
      icon: LaptopIcon,
      label: "Endpoints",
      value: summary.endpoint,
    },
    {
      icon: UserFocusIcon,
      label: "Unassigned (In Stock)",
      value: summary.unassigned,
    },
  ];
}

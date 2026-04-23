import {
  UsersFourIcon,
  UserCircleCheckIcon,
  UserCircleDashedIcon,
  UserCirclePlusIcon,
  UserFocusIcon,
} from "@phosphor-icons/react";

export function getEmployeesOverviewConfig(summary) {
  return [
    {
      icon: UsersFourIcon,
      label: "Total Employees",
      value: summary.total,
    },
    {
      icon: UserCircleCheckIcon,
      label: "Active Employees",
      value: summary.active,
      variant: "greenCard",
    },
    {
      icon: UserCircleDashedIcon,
      label: "Inactive Employees",
      value: summary.inactive,
      variant: "redCard",
    },
    {
      icon: UserCirclePlusIcon,
      label: "New Hires",
      value: summary.newHires30Days,
    },
    {
      icon: UserFocusIcon,
      label: "On Probation",
      value: summary.probation,
    },
    {
      icon: UserFocusIcon,
      label: "Interns",
      value: summary.interns,
    },
  ];
}

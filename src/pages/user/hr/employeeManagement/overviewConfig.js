import {
  UsersFourIcon,
  UserCircleCheckIcon,
  UserCircleDashedIcon,
  UserCirclePlusIcon,
  UserFocusIcon,
} from "@phosphor-icons/react";

export function getEmployeesOverviewConfig(kpis) {
  return [
    {
      icon: UsersFourIcon,
      label: "Total Employees",
      value: kpis.totalEmployees,
      filter: null,
    },
    {
      icon: UserCircleCheckIcon,
      label: "Active Employees",
      value: kpis.activeEmployees,
      variant: "greenCard",
      filter: { employmentStatus: 1 },
    },
    {
      icon: UserCircleDashedIcon,
      label: "Inactive Employees",
      value: kpis.terminatedEmployees,
      variant: "yellowCard",
      filter: { employmentStatus: 4 },
    },
    {
      icon: UserCirclePlusIcon,
      label: "Average Team Size",
      value: kpis.employeesWithoutManager,
      filter: null,
    },
  ];
}

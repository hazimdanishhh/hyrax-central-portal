import { ListIcon, TableIcon } from "@phosphor-icons/react";

export function getEmployeesLayoutConfig() {
  return [
    {
      icon: TableIcon,
      tooltipName: "Card View",
      value: 1,
    },
    {
      icon: ListIcon,
      tooltipName: "Table View",
      value: 2,
    },
  ];
}

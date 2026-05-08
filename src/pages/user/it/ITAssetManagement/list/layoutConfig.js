import { SquaresFourIcon, TableIcon } from "@phosphor-icons/react";

export function getAssetsLayoutConfig() {
  return [
    {
      icon: SquaresFourIcon,
      tooltipName: "Card View",
      value: 1,
    },
    {
      icon: TableIcon,
      tooltipName: "Table View",
      value: 2,
    },
  ];
}

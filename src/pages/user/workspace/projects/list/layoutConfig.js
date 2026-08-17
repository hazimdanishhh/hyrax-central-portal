import { SquaresFourIcon, TableIcon } from "@phosphor-icons/react";

// Strictly 2-option -- PageActions' view toggle is binary today
// (options.find(opt => opt.value !== layout) only ever surfaces one
// "switch to X" button). Board view is a deliberately deferred v2 item
// (see plan's "Deliberately deferred" section) -- List only for this pass.
export function getProjectsLayoutConfig() {
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

import { ListIcon, TableIcon } from "@phosphor-icons/react";

// value 1 renders <DataTable> (Table), value 2 renders the card/list layout
// (see EmployeeManagement.jsx's layout === 1/2 ternary) -- tooltipName below
// previously had these two swapped relative to what each value actually
// renders, even though the icons were already correct.
export function getEmployeesLayoutConfig() {
  return [
    {
      icon: TableIcon,
      tooltipName: "Table View",
      value: 1,
    },
    {
      icon: ListIcon,
      tooltipName: "Card View",
      value: 2,
    },
  ];
}

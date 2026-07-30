import { SquaresFourIcon, TableIcon } from "@phosphor-icons/react";

// Previously inverted vs. what AttendanceManagement.jsx actually rendered
// for each value (value 1, labeled "Card View", rendered DataTable; value 2,
// labeled "Table View" and the default, rendered the AttendanceCard grid) --
// fixed so the label matches the component each value renders.
export function getAttendanceActivitiesLayoutConfig() {
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

import { ListChecksIcon, CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";

// Flat, simple shape -- matches getProjectsOverviewConfig's own style, the
// explicit style target for a small, working-list KPI row (not Employee
// Management's more elaborate one). `to: ""` -- these tiles render ON the
// same list page they filter (no separate overview/list split for this
// module), so a click just re-applies `?status=...` to the current path,
// the same mechanism StatusTab's own `to` already uses.
export function getLifecycleCasesOverviewConfig(kpis) {
  return [
    {
      label: "Open Cases",
      value: kpis.openCount,
      icon: ListChecksIcon,
      variant: "blueCardFill",
      filter: { status: "OPEN" },
      to: "",
    },
    {
      label: "Completed This Month",
      value: kpis.completedThisMonthCount,
      icon: CheckCircleIcon,
      variant: "greenCard",
      filter: { status: "COMPLETED" },
      to: "",
    },
    {
      label: "Stuck > 14 Days",
      value: kpis.stuckCount,
      icon: WarningIcon,
      variant: kpis.stuckCount > 0 ? "redCard" : "greenCard",
      filter: { status: "OPEN" },
      to: "",
    },
  ];
}

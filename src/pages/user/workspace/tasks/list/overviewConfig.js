import { ListChecksIcon, CheckCircleIcon, ClockIcon, WarningIcon } from "@phosphor-icons/react";

/**
 * Same flat, simple shape as the Projects list's overviewConfig.js. To Do/
 * In Progress are deliberately left out -- already one click away via this
 * page's own status tabs; Overdue/Due Soon are the genuinely new signal
 * (a computed due_date condition, not a raw status), driven by the
 * dueStatus filter added to fetchMyTasks/filterConfig.js.
 */
export function getMyTasksOverviewConfig(kpis) {
  return [
    {
      label: "Total Tasks",
      value: kpis.totalCount,
      icon: ListChecksIcon,
      variant: "blueCardFill",
      filter: null,
      to: "/app/workspace/tasks",
    },
    {
      label: "Overdue",
      value: kpis.overdueCount,
      icon: WarningIcon,
      variant: kpis.overdueCount > 0 ? "redCard" : "greenCard",
      filter: { dueStatus: "overdue" },
      to: "/app/workspace/tasks",
    },
    {
      label: "Due Soon",
      value: kpis.dueSoonCount,
      icon: ClockIcon,
      variant: kpis.dueSoonCount > 0 ? "yellowCard" : "greenCard",
      filter: { dueStatus: "due_soon" },
      to: "/app/workspace/tasks",
    },
    {
      label: "Completed",
      value: kpis.completedCount,
      icon: CheckCircleIcon,
      variant: "greenCard",
      filter: { status: "COMPLETED" },
      to: "/app/workspace/tasks",
    },
  ];
}

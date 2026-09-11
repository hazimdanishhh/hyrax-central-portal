import { ListChecksIcon, CheckCircleIcon, ClockIcon, WarningIcon } from "@phosphor-icons/react";
import { getStatusVariant } from "../../../../../functions/statusVariant";

/**
 * Same flat, 4-tile shape as the Projects list's overviewConfig.js. To Do/
 * In Progress are deliberately left out -- already one click away via this
 * page's own status tabs; Overdue/Due Soon are the genuinely new signal
 * (a computed due_date condition, not a raw status), driven by the
 * dueStatus filter added to fetchMyTasks/filterConfig.js.
 *
 * Overdue/Due Soon route through getStatusVariant (docs/DASHBOARD-CONVENTIONS.md
 * §4) instead of a hand-rolled ternary -- matches Projects' own overview
 * and every other dynamic tile in the app. Overdue is capped critical at 1;
 * Due Soon is capped at warning, never critical -- a heads-up, not a
 * crisis, same as Attendance's own Due Soon-shaped tiles.
 */
export function getMyTasksOverviewConfig(kpis) {
  const overdue = getStatusVariant(kpis.overdueCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "critical",
    thresholds: { criticalAt: 1 },
  });
  const dueSoon = getStatusVariant(kpis.dueSoonCount, {
    direction: "low-good",
    tiers: 2,
    badLevel: "warning",
    thresholds: { criticalAt: 1 },
  });

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
      variant: overdue.variant,
      status: overdue.statusLabel ? { icon: overdue.statusIcon, label: overdue.statusLabel } : null,
      filter: { dueStatus: "overdue" },
      to: "/app/workspace/tasks",
    },
    {
      label: "Due Soon",
      value: kpis.dueSoonCount,
      icon: ClockIcon,
      variant: dueSoon.variant,
      status: dueSoon.statusLabel ? { icon: dueSoon.statusIcon, label: dueSoon.statusLabel } : null,
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

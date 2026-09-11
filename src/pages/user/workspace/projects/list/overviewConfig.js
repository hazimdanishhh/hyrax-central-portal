import { FolderIcon, CheckCircleIcon, WarningIcon, ClockIcon } from "@phosphor-icons/react";
import { getStatusVariant } from "../../../../../functions/statusVariant";

/**
 * Kept at exactly 4 tiles by explicit product decision (2026-09) --
 * Total, Active, Overdue, Due Soon. Planning/On Hold were dropped to make
 * room for the due-date-aware pair (still fully visible via the list's
 * own status filter, just no longer a top-row tile).
 *
 * Overdue/Due Soon route through getStatusVariant (docs/DASHBOARD-CONVENTIONS.md
 * §4) instead of a hand-rolled ternary -- matches every other dynamic tile
 * in the app (HR/Attendance), and gets the severity status badge for free.
 * Overdue is capped critical at 1 (any overdue project is immediately a
 * problem); Due Soon is capped at warning, never critical -- a heads-up,
 * not a crisis, same as Attendance's own Due Soon-shaped tiles.
 */
export function getProjectsOverviewConfig(kpis) {
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
      label: "Total Projects",
      value: kpis.totalCount,
      icon: FolderIcon,
      variant: "blueCardFill",
      filter: null,
      to: "/app/workspace/projects",
    },
    {
      label: "Overdue",
      value: kpis.overdueCount,
      icon: WarningIcon,
      variant: overdue.variant,
      status: overdue.statusLabel ? { icon: overdue.statusIcon, label: overdue.statusLabel } : null,
      filter: { dueStatus: "overdue" },
      to: "/app/workspace/projects",
    },
    {
      label: "Due Soon",
      value: kpis.dueSoonCount,
      icon: ClockIcon,
      variant: dueSoon.variant,
      status: dueSoon.statusLabel ? { icon: dueSoon.statusIcon, label: dueSoon.statusLabel } : null,
      filter: { dueStatus: "due_soon" },
      to: "/app/workspace/projects",
    },
    {
      label: "Active",
      value: kpis.activeCount,
      icon: CheckCircleIcon,
      variant: "greenCard",
      filter: { status: "ACTIVE" },
      to: "/app/workspace/projects",
    },
  ];
}

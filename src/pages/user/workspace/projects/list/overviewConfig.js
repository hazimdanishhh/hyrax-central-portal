import { FolderIcon, CheckCircleIcon, ClockIcon, WarningIcon } from "@phosphor-icons/react";

/**
 * Flat, simple shape (no sublabel/status/metrics sub-rows) -- matches the
 * superadmin Users page's overviewConfig.js, the explicit style target,
 * not HR Employee Management's more elaborate one (same OverviewCards
 * component either way). Completed/Cancelled are deliberately left out --
 * terminal/low-signal for a working list, already last in this page's own
 * status tabs. Planning is included since it's newly meaningful after
 * auto_activate_project_on_task_started -- a project stuck in Planning is
 * a real "hasn't started" signal.
 */
export function getProjectsOverviewConfig(kpis) {
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
      label: "Active",
      value: kpis.activeCount,
      icon: CheckCircleIcon,
      variant: "greenCard",
      filter: { status: "ACTIVE" },
      to: "/app/workspace/projects",
    },
    {
      label: "Planning",
      value: kpis.planningCount,
      icon: ClockIcon,
      variant: "blueCard",
      filter: { status: "PLANNING" },
      to: "/app/workspace/projects",
    },
    {
      label: "On Hold",
      value: kpis.onHoldCount,
      icon: WarningIcon,
      variant: kpis.onHoldCount > 0 ? "redCard" : "greenCard",
      filter: { status: "ON_HOLD" },
      to: "/app/workspace/projects",
    },
  ];
}
